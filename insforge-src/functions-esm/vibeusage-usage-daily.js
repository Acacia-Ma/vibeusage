import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
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
import { buildPricingMetadata, formatUsdFromMicros } from "./shared/pricing.js";
import { getSourceParam, normalizeSource } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import {
  addRowTotals,
  applyTotalsAndBillable,
  buildPricingBucketKey,
  createTotals,
  extractDateKey,
  getModelParam,
  getSourceEntry,
  normalizeUsageModel,
  normalizeUsageModelKey,
  resolveBillableTotals,
  resolveUsageFilterContext,
} from "./shared/usage-summary-support.js";

const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const { resolveAggregateUsagePricing } = usagePricingCore;

export default withRequestLogging("vibeusage-usage-daily", async function (request, logger) {
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
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;
  const hasModelParam = model != null;
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
  const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    await resolveUsageFilterContext({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: to,
    });

  const { buckets } = initDailyBuckets(dayKeys);

  let totals = createTotals();
  let sourcesMap = new Map();
  let distinctModels = new Set();
  const distinctUsageModels = new Set();
  const pricingBuckets = hasModelParam ? null : new Map();

  const ingestRow = (row) => {
    const sourceKey = normalizeSource(row?.source) || "codex";
    const { billable, hasStoredBillable } = resolveBillableTotals({ row, source: sourceKey });
    applyTotalsAndBillable({ totals, row, billable, hasStoredBillable });
    const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
    applyTotalsAndBillable({ totals: sourceEntry.totals, row, billable, hasStoredBillable });
    const normalizedModel = normalizeUsageModel(row?.model);
    if (normalizedModel && normalizedModel !== "unknown") {
      distinctModels.add(normalizedModel);
    }
    if (!hasModelParam && pricingBuckets) {
      const usageKey = normalizeUsageModelKey(normalizedModel) || DEFAULT_MODEL;
      const dateKey = extractDateKey(row?.hour_start || row?.day) || to;
      const bucketKey = buildPricingBucketKey(sourceKey, usageKey, dateKey);
      const bucket = pricingBuckets.get(bucketKey) || createTotals();
      addRowTotals(bucket, row);
      pricingBuckets.set(bucketKey, bucket);
      distinctUsageModels.add(usageKey);
    }
    return billable;
  };

  const queryStartMs = Date.now();
  let rowCount = 0;
  const rollupHit = false;

  const sumHourlyRange = async () => {
    const { error, rowCount: scannedRows } = await forEachHourlyUsagePage({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      usageModels,
      canonicalModel,
      startIso,
      endIso,
      select:
        "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
      onPage: (rows) => {
        for (const row of rows) {
          const ts = row?.hour_start;
          if (!ts) continue;
          const dt = new Date(ts);
          if (!Number.isFinite(dt.getTime())) continue;
          if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) {
            continue;
          }
          const billable = ingestRow(row);
          applyDailyBucket({ buckets, row, tzContext, billable });
        }
      },
    });
    rowCount += scannedRows;
    if (error) return { ok: false, error };
    return { ok: true };
  };
  const hourlyRes = await sumHourlyRange();
  if (!hourlyRes.ok) return respond({ error: hourlyRes.error.message }, 500, Date.now() - queryStartMs);

  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: "usage_daily",
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: rollupHit,
  });

  const pricingSummary = await resolveAggregateUsagePricing({
    edgeClient: auth.edgeClient,
    canonicalModel,
    distinctModels,
    distinctUsageModels,
    pricingBuckets,
    effectiveDate: to,
    sourcesMap,
    totals,
    defaultModel: DEFAULT_MODEL,
  });

  const rows = dayKeys.map((day) => {
    const bucket = buckets.get(day);
    return {
      day,
      total_tokens: bucket.total.toString(),
      billable_total_tokens: bucket.billable.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString(),
    };
  });

  const summary = {
    totals: {
      total_tokens: totals.total_tokens.toString(),
      billable_total_tokens: totals.billable_total_tokens.toString(),
      input_tokens: totals.input_tokens.toString(),
      cached_input_tokens: totals.cached_input_tokens.toString(),
      output_tokens: totals.output_tokens.toString(),
      reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
      total_cost_usd: formatUsdFromMicros(pricingSummary.totalCostMicros),
    },
    pricing: buildPricingMetadata({
      profile: pricingSummary.overallCost.profile,
      pricingMode: pricingSummary.summaryPricingMode,
    }),
  };

  return respond(
    {
      from,
      to,
      model_id: hasModelParam ? pricingSummary.impliedModelId || null : null,
      model:
        hasModelParam && pricingSummary.impliedModelId
          ? pricingSummary.impliedModelDisplay
          : null,
      data: rows,
      summary,
    },
    200,
    queryDurationMs,
  );
});
