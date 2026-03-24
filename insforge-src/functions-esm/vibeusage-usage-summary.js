import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { buildHourlyUsageQuery } from "./shared/db/usage-hourly.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
import {
  addDatePartsDays,
  formatDateParts,
  formatLocalDateKey,
  getLocalParts,
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
import { buildPricingMetadata, formatUsdFromMicros } from "./shared/pricing.js";
import { getSourceParam, normalizeSource } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import {
  addRowTotals,
  applyTotalsAndBillable,
  buildPricingBucketKey,
  createTotals,
  extractDateKey,
  forEachPage,
  getModelParam,
  getSourceEntry,
  normalizeUsageModel,
  normalizeUsageModelKey,
  resolveBillableTotals,
  resolveUsageFilterContext,
} from "./shared/usage-summary-support.js";

const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const { resolveAggregateUsagePricing } = usagePricingCore;

export default withRequestLogging("vibeusage-usage-summary", async function (request, logger) {
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
  const rollingEnabled = url.searchParams.get("rolling") === "1";
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

  const auth = await getAccessContext({
    baseUrl: getBaseUrl(),
    bearer,
    allowPublic: true,
  });
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

  let totals = createTotals();
  let sourcesMap = new Map();
  let distinctModels = new Set();
  const distinctUsageModels = new Set();
  const pricingBuckets = hasModelParam ? null : new Map();

  const queryStartMs = Date.now();
  let rowCount = 0;

  const ingestRow = (row) => {
    if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) return;
    const sourceKey = normalizeSource(row?.source) || DEFAULT_SOURCE;
    const { billable, hasStoredBillable } = resolveBillableTotals({ row, source: sourceKey });
    applyTotalsAndBillable({ totals, row, billable, hasStoredBillable });
    const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
    applyTotalsAndBillable({ totals: sourceEntry.totals, row, billable, hasStoredBillable });
    const normalizedModel = normalizeUsageModel(row?.model);
    if (normalizedModel && normalizedModel !== "unknown") distinctModels.add(normalizedModel);
    if (!hasModelParam && pricingBuckets) {
      const usageKey = normalizeUsageModelKey(normalizedModel) || DEFAULT_MODEL;
      const dateKey = extractDateKey(row?.hour_start || row?.day) || to;
      const bucketKey = buildPricingBucketKey(sourceKey, usageKey, dateKey);
      const bucket = pricingBuckets.get(bucketKey) || createTotals();
      addRowTotals(bucket, row);
      pricingBuckets.set(bucketKey, bucket);
      distinctUsageModels.add(usageKey);
    }
  };

  const sumHourlyRange = async (rangeStartIso, rangeEndIso) => {
    const { error } = await forEachPage({
      createQuery: () =>
        buildHourlyUsageQuery({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          source,
          usageModels,
          canonicalModel,
          startIso: rangeStartIso,
          endIso: rangeEndIso,
          select:
            "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
        }),
      onPage: (rows) => {
        const pageRows = Array.isArray(rows) ? rows : [];
        rowCount += pageRows.length;
        for (const row of pageRows) ingestRow(row);
      },
    });
    if (error) return { ok: false, error };
    return { ok: true };
  };

  const sumHourlyRangeInto = async (rangeStartIso, rangeEndIso, onRow) => {
    const { error } = await forEachPage({
      createQuery: () =>
        buildHourlyUsageQuery({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          source,
          usageModels,
          canonicalModel,
          startIso: rangeStartIso,
          endIso: rangeEndIso,
          select:
            "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
        }),
      onPage: (rows) => {
        for (const row of Array.isArray(rows) ? rows : []) onRow(row);
      },
    });
    if (error) return { ok: false, error };
    return { ok: true };
  };

  const buildRollingWindow = async ({ fromDay, toDay }) => {
    const rangeStartParts = parseDateParts(fromDay);
    const rangeEndParts = parseDateParts(toDay);
    if (!rangeStartParts || !rangeEndParts) return { ok: false, error: new Error("Invalid rolling range") };

    const rangeStartUtc = localDatePartsToUtc(rangeStartParts, tzContext);
    const rangeEndUtc = localDatePartsToUtc(addDatePartsDays(rangeEndParts, 1), tzContext);
    if (!Number.isFinite(rangeStartUtc.getTime()) || !Number.isFinite(rangeEndUtc.getTime())) {
      return { ok: false, error: new Error("Invalid rolling range") };
    }

    const rangeStartIso = rangeStartUtc.toISOString();
    const rangeEndIso = rangeEndUtc.toISOString();
    const rollingTotals = createTotals();
    const activeByDay = new Map();
    const updateActiveByDay = ({ row, billable, hasStoredBillable }) => {
      let dayKey = null;
      if (row?.hour_start) {
        dayKey = formatLocalDateKey(new Date(row.hour_start), tzContext);
      }
      if (!dayKey) return;
      const billableTokens = hasStoredBillable ? toBigInt(row?.billable_total_tokens) : billable;
      if (billableTokens <= 0n) return;
      const prev = activeByDay.get(dayKey) || 0n;
      activeByDay.set(dayKey, prev + billableTokens);
    };
    const ingestRollingRow = (row) => {
      if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) return;
      const sourceKey = normalizeSource(row?.source) || DEFAULT_SOURCE;
      const { billable, hasStoredBillable } = resolveBillableTotals({ row, source: sourceKey });
      applyTotalsAndBillable({ totals: rollingTotals, row, billable, hasStoredBillable });
      updateActiveByDay({ row, billable, hasStoredBillable });
    };

    const sumRes = await sumHourlyRangeInto(rangeStartIso, rangeEndIso, ingestRollingRow);
    if (!sumRes.ok) return sumRes;

    const windowDays = listDateStrings(fromDay, toDay).length;
    const activeDays = Array.from(activeByDay.values()).filter((value) => value > 0n).length;
    const avg = activeDays > 0 ? rollingTotals.billable_total_tokens / BigInt(activeDays) : 0n;
    const avgPerDay = windowDays > 0 ? rollingTotals.billable_total_tokens / BigInt(windowDays) : 0n;
    return {
      ok: true,
      payload: {
        from: fromDay,
        to: toDay,
        window_days: windowDays,
        totals: { billable_total_tokens: rollingTotals.billable_total_tokens.toString() },
        active_days: activeDays,
        avg_per_active_day: avg.toString(),
        avg_per_day: avgPerDay.toString(),
      },
    };
  };

  const hourlyRes = await sumHourlyRange(startIso, endIso);
  if (!hourlyRes.ok) return respond({ error: hourlyRes.error.message }, 500, Date.now() - queryStartMs);

  let rollingPayload = null;
  if (rollingEnabled) {
    const localTodayParts = getLocalParts(new Date(), tzContext);
    const localYesterday = formatDateParts(addDatePartsDays(localTodayParts, -1));
    const rollingToDay = to < localYesterday ? to : localYesterday;
    const rollingEndParts = parseDateParts(rollingToDay);
    if (!rollingEndParts) return respond({ error: "Invalid rolling range" }, 400, 0);
    const last7From = formatDateParts(addDatePartsDays(rollingEndParts, -6));
    const last30From = formatDateParts(addDatePartsDays(rollingEndParts, -29));
    if (!last7From || !last30From) return respond({ error: "Invalid rolling range" }, 400, 0);

    const last7Res = await buildRollingWindow({ fromDay: last7From, toDay: rollingToDay });
    if (!last7Res.ok) return respond({ error: last7Res.error.message }, 500, Date.now() - queryStartMs);
    const last30Res = await buildRollingWindow({ fromDay: last30From, toDay: rollingToDay });
    if (!last30Res.ok) return respond({ error: last30Res.error.message }, 500, Date.now() - queryStartMs);
    rollingPayload = { last_7d: last7Res.payload, last_30d: last30Res.payload };
  }

  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: "usage_summary",
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: false,
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

  const responsePayload = {
    from,
    to,
    days: dayKeys.length,
    model_id: hasModelParam ? pricingSummary.impliedModelId || null : null,
    model:
      hasModelParam && pricingSummary.impliedModelId ? pricingSummary.impliedModelDisplay : null,
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
  if (rollingPayload) responsePayload.rolling = rollingPayload;
  return respond(responsePayload, 200, queryDurationMs);
});
