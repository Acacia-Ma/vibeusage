import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { collectHourlyUsageRows } from "./shared/core/usage-row-collector.js";
import { createUsageJsonResponder } from "./shared/core/usage-response.js";
import {
  getUsageTimeZoneContext,
  resolveUsageDateRangeLocal,
} from "./shared/date.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { buildPricingMetadata, computeUsageCost, resolvePricingProfile } from "./shared/pricing.js";
import { getSourceParam } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import {
  addRowTotals,
  buildPricingBucketKey,
  createTotals,
  resolveIdentityAtDate,
  resolveUsageTimelineContext,
} from "./shared/usage-summary-support.js";

const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const {
  createModelBreakdownState,
  accumulateModelBreakdownRow,
  attributeModelBreakdownBucketCost,
  buildModelBreakdownSources,
  resolveBucketedUsagePricing,
  resolveImpliedModelId,
  resolveSummaryPricingMode,
} = usagePricingCore;

export default withRequestLogging(
  "vibeusage-usage-model-breakdown",
  async function (request, logger) {
    const opt = handleOptions(request);
    if (opt) return opt;

    const url = new URL(request.url);
    const respond = createUsageJsonResponder({ url, logger });

    if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

    const bearer = getBearerToken(request.headers.get("Authorization"));
    if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

    const tzContext = getUsageTimeZoneContext(url);
    const sourceResult = getSourceParam(url);
    if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
    const sourceFilter = sourceResult.source;

    const range = resolveUsageDateRangeLocal({
      fromRaw: url.searchParams.get("from"),
      toRaw: url.searchParams.get("to"),
      tzContext,
    });
    if (!range.ok) return respond({ error: range.error }, 400, 0);
    const { from, to, dayKeys, startIso, endIso } = range;

    const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
    if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

    const rowsBuffer = [];
    const distinctModels = new Set();

    const queryStartMs = Date.now();
    let rowCount = 0;
    const { error, rowCount: scannedRows } = await collectHourlyUsageRows({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source: sourceFilter,
      effectiveDate: to,
      startIso,
      endIso,
      select:
        "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
      rowStateOptions: {
        defaultSource: DEFAULT_SOURCE,
        defaultModel: DEFAULT_MODEL,
        allowMissingTimestamp: true,
      },
      onUsageRow: ({ row, usageRow }) => {
        rowsBuffer.push({
          source: usageRow.sourceKey,
          model: usageRow.normalizedModel,
          usageKey: usageRow.usageKey,
          dateKey: usageRow.dateKey,
          hour_start: usageRow.timestamp,
          total_tokens: row?.total_tokens,
          billable_total_tokens: usageRow.hasStoredBillable
            ? row.billable_total_tokens
            : usageRow.billable.toString(),
          input_tokens: row?.input_tokens,
          cached_input_tokens: row?.cached_input_tokens,
          output_tokens: row?.output_tokens,
          reasoning_output_tokens: row?.reasoning_output_tokens,
        });
        if (usageRow.usageKey && usageRow.usageKey !== DEFAULT_MODEL) {
          distinctModels.add(usageRow.usageKey);
        }
      },
    });
    rowCount += scannedRows;
    const queryDurationMs = Date.now() - queryStartMs;
    logSlowQuery(logger, {
      query_label: "usage_model_breakdown",
      duration_ms: queryDurationMs,
      row_count: rowCount,
      range_days: dayKeys.length,
      source: sourceFilter || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    });

    if (error) return respond({ error: error.message }, 500, queryDurationMs);

    const timelineContext = await resolveUsageTimelineContext({
      edgeClient: auth.edgeClient,
      usageModels: Array.from(distinctModels.values()),
      effectiveDate: to,
    });
    const usageModels = timelineContext.usageModels;
    const aliasTimeline = timelineContext.aliasTimeline;

    const breakdownState = createModelBreakdownState();
    const costBuckets = new Map();
    const grandTotals = createTotals();

    for (const row of rowsBuffer) {
      addRowTotals(grandTotals, row);
      const dateKey = row.dateKey || to;
      const identity = resolveIdentityAtDate({
        rawModel: row.model,
        usageKey: row.usageKey,
        dateKey,
        timeline: aliasTimeline,
      });
      accumulateModelBreakdownRow({
        state: breakdownState,
        row,
        identity,
        defaultModel: DEFAULT_MODEL,
      });

      const bucketKey = buildPricingBucketKey(row.source, row.usageKey || DEFAULT_MODEL, dateKey);
      const bucket = costBuckets.get(bucketKey) || {
        source: row.source,
        totals: createTotals(),
      };
      addRowTotals(bucket.totals, row);
      costBuckets.set(bucketKey, bucket);
    }

    const bucketedPricing = await resolveBucketedUsagePricing({
      edgeClient: auth.edgeClient,
      pricingBuckets: costBuckets,
      usageModels,
      effectiveDate: to,
      onBucketCost: ({ bucket, identity, cost }) => {
        attributeModelBreakdownBucketCost({
          state: breakdownState,
          source: bucket?.source,
          identity,
          costMicros: cost.cost_micros,
          defaultModel: DEFAULT_MODEL,
        });
      },
    });

    const impliedModelId = resolveImpliedModelId({
      canonicalModel: null,
      canonicalModels: bucketedPricing.canonicalModels,
    });
    const pricingProfile = await resolvePricingProfile({
      edgeClient: auth.edgeClient,
      model: impliedModelId,
      effectiveDate: to,
    });

    const sources = buildModelBreakdownSources({
      state: breakdownState,
      pricingProfile,
    });

    const overallCost = computeUsageCost(grandTotals, pricingProfile);
    const summaryPricingMode = resolveSummaryPricingMode({
      pricingModes: bucketedPricing.pricingModes,
      overallPricingMode: overallCost.pricing_mode,
    });

    return respond(
      {
        from,
        to,
        days: dayKeys.length,
        sources,
        pricing: buildPricingMetadata({
          profile: overallCost.profile,
          pricingMode: summaryPricingMode,
        }),
      },
      200,
      queryDurationMs,
    );
  },
);
