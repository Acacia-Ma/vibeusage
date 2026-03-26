import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import { collectFilteredUsageRows } from "./shared/core/usage-filtered-rows.js";
import { resolveUsageRangeRequestContext } from "./shared/core/usage-range-request.js";
import { getUsageTimeZoneContext } from "./shared/date.js";
import { withRequestLogging } from "./shared/logging.js";
import { buildPricingMetadata, computeUsageCost, resolvePricingProfile } from "./shared/pricing.js";
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
    const endpoint = prepareUsageEndpoint({ request, logger });
    if (!endpoint.ok) return endpoint.response;
    const { url, respond, bearer } = endpoint;

    const tzContext = getUsageTimeZoneContext(url);
    const requestContext = resolveUsageRangeRequestContext({ url, tzContext });
    if (!requestContext.ok) return respondUsageRequestError(respond, requestContext);
    const { source: sourceFilter, from, to, dayKeys, startIso, endIso } = requestContext;

    const access = await requireUsageAccess({ respond, bearer });
    if (!access.ok) return access.response;
    const { auth } = access;

    const rowsBuffer = [];
    const distinctModels = new Set();

    const { error, queryDurationMs } = await collectFilteredUsageRows({
      logger,
      queryLabel: "usage_model_breakdown",
      logMeta: {
        range_days: dayKeys.length,
        source: sourceFilter || null,
        tz: tzContext?.timeZone || null,
        tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes)
          ? tzContext.offsetMinutes
          : null,
      },
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source: sourceFilter,
      effectiveDate: to,
      startIso,
      endIso,
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
