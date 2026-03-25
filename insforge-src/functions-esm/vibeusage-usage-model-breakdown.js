import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { buildHourlyUsageQuery } from "./shared/db/usage-hourly.js";
import {
  addDatePartsDays,
  getUsageMaxDays,
  getUsageTimeZoneContext,
  listDateStrings,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  parseDateParts,
} from "./shared/date.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { toBigInt } from "./shared/numbers.js";
import { buildPricingMetadata, computeUsageCost, formatUsdFromMicros, resolvePricingProfile } from "./shared/pricing.js";
import { normalizeSource, getSourceParam } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import {
  addRowTotals,
  buildPricingBucketKey,
  createTotals,
  extractDateKey,
  forEachPage,
  getModelParam,
  normalizeUsageModel,
  normalizeUsageModelKey,
  resolveBillableTotals,
  resolveIdentityAtDate,
  resolveUsageTimelineContext,
} from "./shared/usage-summary-support.js";

const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const { resolveBucketedUsagePricing, resolveImpliedModelId, resolveSummaryPricingMode } =
  usagePricingCore;

export default withRequestLogging(
  "vibeusage-usage-model-breakdown",
  async function (request, logger) {
    const opt = handleOptions(request);
    if (opt) return opt;

    const url = new URL(request.url);
    const debugEnabled = isDebugEnabled(url);
    const respond = (body, status, durationMs) =>
      json(
        debugEnabled ? withSlowQueryDebugPayload(body, { logger, durationMs, status }) : body,
        status,
      );

    if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

    const bearer = getBearerToken(request.headers.get("Authorization"));
    if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

    const tzContext = getUsageTimeZoneContext(url);
    const sourceResult = getSourceParam(url);
    if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
    const sourceFilter = sourceResult.source;

    const { from, to } = normalizeDateRangeLocal(
      url.searchParams.get("from"),
      url.searchParams.get("to"),
      tzContext,
    );

    const dayKeys = listDateStrings(from, to);
    const maxDays = getUsageMaxDays();
    if (dayKeys.length > maxDays) {
      return respond({ error: `Date range too large (max ${maxDays} days)` }, 400, 0);
    }

    const startParts = parseDateParts(from);
    const endParts = parseDateParts(to);
    if (!startParts || !endParts) return respond({ error: "Invalid date range" }, 400, 0);

    const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
    if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

    const startUtc = localDatePartsToUtc(startParts, tzContext);
    const endUtc = localDatePartsToUtc(addDatePartsDays(endParts, 1), tzContext);
    const startIso = startUtc.toISOString();
    const endIso = endUtc.toISOString();

    const rowsBuffer = [];
    const distinctModels = new Set();

    const queryStartMs = Date.now();
    let rowCount = 0;
    const { error } = await forEachPage({
      createQuery: () =>
        buildHourlyUsageQuery({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          source: sourceFilter,
          startIso,
          endIso,
          select:
            "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
        }),
      onPage: (rows) => {
        const pageRows = Array.isArray(rows) ? rows : [];
        rowCount += pageRows.length;
        for (const row of pageRows) {
          const source = normalizeSource(row?.source) || DEFAULT_SOURCE;
          const model = normalizeUsageModel(row?.model) || DEFAULT_MODEL;
          const usageKey = normalizeUsageModelKey(model);
          const { billable, hasStoredBillable } = resolveBillableTotals({ row, source });
          rowsBuffer.push({
            source,
            model,
            usageKey,
            hour_start: row?.hour_start,
            total_tokens: row?.total_tokens,
            billable_total_tokens: hasStoredBillable ? row.billable_total_tokens : billable.toString(),
            input_tokens: row?.input_tokens,
            cached_input_tokens: row?.cached_input_tokens,
            output_tokens: row?.output_tokens,
            reasoning_output_tokens: row?.reasoning_output_tokens,
          });
          if (usageKey && usageKey !== DEFAULT_MODEL) {
            distinctModels.add(usageKey);
          }
        }
      },
    });
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

    const sourcesMap = new Map();
    const costBuckets = new Map();
    const grandTotals = createTotals();

    for (const row of rowsBuffer) {
      const sourceEntry = getSourceEntry(sourcesMap, row.source);
      addRowTotals(sourceEntry.totals, row);
      addRowTotals(grandTotals, row);
      const dateKey = extractDateKey(row.hour_start) || to;
      const identity = resolveIdentityAtDate({
        rawModel: row.model,
        usageKey: row.usageKey,
        dateKey,
        timeline: aliasTimeline,
      });
      const canonicalEntry = getCanonicalEntry(sourceEntry.models, identity);
      addRowTotals(canonicalEntry.totals, row);

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
        const sourceEntry = bucket?.source ? sourcesMap.get(bucket.source) : null;
        addCostMicros(sourceEntry, cost.cost_micros);
        if (sourceEntry) {
          const modelEntry = getCanonicalEntry(sourceEntry.models, identity);
          addCostMicros(modelEntry, cost.cost_micros);
        }
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

    const sources = Array.from(sourcesMap.values())
      .map((entry) => {
        const models = Array.from(entry.models.values())
          .map((modelEntry) => formatTotals(modelEntry, pricingProfile))
          .sort(compareTotals);
        const totals = formatTotals(entry, pricingProfile).totals;
        return {
          source: entry.source,
          totals,
          models,
        };
      })
      .sort((a, b) => a.source.localeCompare(b.source));

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

function getSourceEntry(map, source) {
  if (map.has(source)) return map.get(source);
  const entry = {
    source,
    totals: createTotals(),
    models: new Map(),
  };
  map.set(source, entry);
  return entry;
}

function getCanonicalEntry(map, identity) {
  const key = identity?.model_id || DEFAULT_MODEL;
  if (map.has(key)) return map.get(key);
  const entry = {
    model_id: key,
    model: identity?.model || key,
    totals: createTotals(),
  };
  map.set(key, entry);
  return entry;
}

function formatTotals(entry, pricingProfile) {
  const totals = entry.totals;
  const costMicros = resolveCostMicros(entry, pricingProfile);
  const { cost_micros: _ignored, ...rest } = entry;
  return {
    ...rest,
    totals: {
      total_tokens: totals.total_tokens.toString(),
      billable_total_tokens: totals.billable_total_tokens.toString(),
      input_tokens: totals.input_tokens.toString(),
      cached_input_tokens: totals.cached_input_tokens.toString(),
      output_tokens: totals.output_tokens.toString(),
      reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
      total_cost_usd: formatUsdFromMicros(costMicros),
    },
  };
}

function compareTotals(a, b) {
  const aSort = toBigInt(a?.totals?.billable_total_tokens ?? a?.totals?.total_tokens);
  const bSort = toBigInt(b?.totals?.billable_total_tokens ?? b?.totals?.total_tokens);
  if (aSort === bSort) return String(a?.model || "").localeCompare(String(b?.model || ""));
  return aSort > bSort ? -1 : 1;
}

function addCostMicros(entry, costMicros) {
  if (!entry) return;
  entry.cost_micros = toBigInt(entry.cost_micros) + toBigInt(costMicros);
}

function resolveCostMicros(entry, pricingProfile) {
  if (!entry) return 0n;
  if (typeof entry.cost_micros === "bigint") return entry.cost_micros;
  const cost = computeUsageCost(entry.totals, pricingProfile);
  return cost.cost_micros;
}
