import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { buildHourlyUsageQuery } from "./shared/db/usage-hourly.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
import {
  addDatePartsDays,
  getUsageMaxDays,
  getUsageTimeZoneContext,
  isUtcTimeZone,
  listDateStrings,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  parseDateParts,
} from "./shared/date.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { buildPricingMetadata, computeUsageCost, formatUsdFromMicros, resolvePricingProfile } from "./shared/pricing.js";
import { getSourceParam, normalizeSource } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import {
  addRowTotals,
  applyTotalsAndBillable,
  applyModelIdentity,
  buildAliasTimeline,
  buildPricingBucketKey,
  createTotals,
  extractDateKey,
  fetchAliasRows,
  fetchRollupRows,
  forEachPage,
  getModelParam,
  getSourceEntry,
  isRollupEnabled,
  normalizeUsageModel,
  normalizeUsageModelKey,
  resolveBillableTotals,
  resolveDisplayName,
  resolveModelIdentity,
  resolveUsageModelsForCanonical,
} from "./shared/usage-summary-support.js";

const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const {
  resolveBucketedUsagePricing,
  accumulateSourceCostMicros,
  resolveImpliedModelId,
  resolveSummaryPricingMode,
} = usagePricingCore;

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
  const modelFilter = await resolveUsageModelsForCanonical({
    edgeClient: auth.edgeClient,
    canonicalModel: model,
    effectiveDate: to,
  });
  const canonicalModel = modelFilter.canonical;
  const usageModels = modelFilter.usageModels;
  const hasModelFilter = Array.isArray(usageModels) && usageModels.length > 0;
  let aliasTimeline = null;
  if (hasModelFilter) {
    const aliasRows = await fetchAliasRows({
      edgeClient: auth.edgeClient,
      usageModels,
      effectiveDate: to,
    });
    aliasTimeline = buildAliasTimeline({ usageModels, aliasRows });
  }

  const { buckets } = initDailyBuckets(dayKeys);

  let totals = createTotals();
  let sourcesMap = new Map();
  let distinctModels = new Set();
  const distinctUsageModels = new Set();
  const pricingBuckets = hasModelParam ? null : new Map();

  const resetAggregation = () => {
    totals = createTotals();
    sourcesMap = new Map();
    distinctModels = new Set();
    rowCount = 0;
    rollupHit = false;
  };

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
  let rollupHit = false;
  let hourlyError = null;
  const rollupEnabled = isRollupEnabled();

  const sumHourlyRange = async () => {
    const { error } = await forEachPage({
      createQuery: () =>
        buildHourlyUsageQuery({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          source,
          usageModels,
          canonicalModel,
          startIso,
          endIso,
          select:
            "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
        }),
      onPage: (rows) => {
        const pageRows = Array.isArray(rows) ? rows : [];
        rowCount += pageRows.length;
        for (const row of pageRows) {
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
    if (error) return { ok: false, error };
    return { ok: true };
  };

  const hasHourlyData = async (rangeStartIso, rangeEndIso) => {
    const { data, error } = await buildHourlyUsageQuery({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      usageModels,
      canonicalModel,
      startIso: rangeStartIso,
      endIso: rangeEndIso,
      select: "hour_start",
    }).limit(1);
    if (error) return { ok: false, error };
    return { ok: true, hasRows: Array.isArray(data) && data.length > 0 };
  };

  if (rollupEnabled && isUtcTimeZone(tzContext)) {
    const rollupRes = await fetchRollupRows({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      fromDay: from,
      toDay: to,
      source,
      model: canonicalModel || null,
    });
    if (rollupRes.ok) {
      const rows = Array.isArray(rollupRes.rows) ? rollupRes.rows : [];
      rowCount += rows.length;
      rollupHit = true;
      for (const row of rows) {
        const day = row?.day;
        const bucket = buckets.get(day);
        if (!bucket) continue;
        if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) {
          continue;
        }
        const dayValue = row?.day;
        const rowForBucket =
          row?.hour_start || !dayValue ? row : { ...row, hour_start: `${dayValue}T00:00:00.000Z` };
        const billable = ingestRow(row);
        applyDailyBucket({ buckets, row: rowForBucket, tzContext, billable });
      }

      if (rows.length === 0) {
        const hourlyCheck = await hasHourlyData(startIso, endIso);
        if (!hourlyCheck.ok) {
          hourlyError = hourlyCheck.error;
        } else if (hourlyCheck.hasRows) {
          resetAggregation();
          const hourlyRes = await sumHourlyRange();
          if (!hourlyRes.ok) hourlyError = hourlyRes.error;
        }
      }
    } else {
      resetAggregation();
      const hourlyRes = await sumHourlyRange();
      if (!hourlyRes.ok) hourlyError = hourlyRes.error;
    }
  } else {
    const hourlyRes = await sumHourlyRange();
    if (!hourlyRes.ok) hourlyError = hourlyRes.error;
  }

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

  if (hourlyError) return respond({ error: hourlyError.message }, 500, queryDurationMs);

  const identityMap = await resolveModelIdentity({
    edgeClient: auth.edgeClient,
    usageModels: Array.from(distinctModels.values()),
    effectiveDate: to,
  });
  let canonicalModels = new Set();
  for (const modelValue of distinctModels.values()) {
    const identity = applyModelIdentity({ rawModel: modelValue, identityMap });
    if (identity.model_id && identity.model_id !== DEFAULT_MODEL) {
      canonicalModels.add(identity.model_id);
    }
  }

  let totalCostMicros = 0n;
  const pricingModes = new Set();
  let pricingProfile = null;

  if (!hasModelParam && pricingBuckets && pricingBuckets.size > 0) {
    const usageModelList = Array.from(distinctUsageModels.values());
    if (usageModelList.length > 0) {
      const bucketedPricing = await resolveBucketedUsagePricing({
        edgeClient: auth.edgeClient,
        pricingBuckets,
        usageModels: usageModelList,
        effectiveDate: to,
        defaultModel: DEFAULT_MODEL,
      });
      totalCostMicros += bucketedPricing.totalCostMicros;
      canonicalModels = bucketedPricing.canonicalModels;
      for (const mode of bucketedPricing.pricingModes.values()) {
        pricingModes.add(mode);
      }
    }
  }

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

  const impliedModelId = resolveImpliedModelId({ canonicalModel, canonicalModels });
  const impliedModelDisplay = resolveDisplayName(identityMap, impliedModelId);
  if (!pricingProfile) {
    pricingProfile = await resolvePricingProfile({
      edgeClient: auth.edgeClient,
      model: impliedModelId,
      effectiveDate: to,
    });
  }

  if (pricingModes.size === 0) {
    const sourceCosts = accumulateSourceCostMicros({ sourcesMap, pricingProfile });
    totalCostMicros += sourceCosts.totalCostMicros;
    for (const mode of sourceCosts.pricingModes.values()) {
      pricingModes.add(mode);
    }
  }

  const overallCost = computeUsageCost(totals, pricingProfile);

  const summaryPricingMode = resolveSummaryPricingMode({
    pricingModes,
    overallPricingMode: overallCost.pricing_mode,
  });

  const summary = {
    totals: {
      total_tokens: totals.total_tokens.toString(),
      billable_total_tokens: totals.billable_total_tokens.toString(),
      input_tokens: totals.input_tokens.toString(),
      cached_input_tokens: totals.cached_input_tokens.toString(),
      output_tokens: totals.output_tokens.toString(),
      reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
      total_cost_usd: formatUsdFromMicros(totalCostMicros),
    },
    pricing: buildPricingMetadata({
      profile: overallCost.profile,
      pricingMode: summaryPricingMode,
    }),
  };

  return respond(
    {
      from,
      to,
      model_id: hasModelParam ? impliedModelId || null : null,
      model: hasModelParam && impliedModelId ? impliedModelDisplay : null,
      data: rows,
      summary,
    },
    200,
    queryDurationMs,
  );
});
