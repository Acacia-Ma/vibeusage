import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
import {
  getUsageTimeZoneContext,
  resolveUsageDateRangeLocal,
} from "./shared/date.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { getSourceParam } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import "../shared/usage-metrics-core.mjs";
import {
  getModelParam,
  resolveUsageFilterContext,
} from "./shared/usage-summary-support.js";

const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const {
  createAggregateUsageState,
  accumulateAggregateUsageRow,
  buildAggregateUsagePayload,
  resolveAggregateUsagePricing,
} = usagePricingCore;
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

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
  const range = resolveUsageDateRangeLocal({
    fromRaw: url.searchParams.get("from"),
    toRaw: url.searchParams.get("to"),
    tzContext,
  });
  if (!range.ok) return respond({ error: range.error }, 400, 0);
  const { from, to, dayKeys, startIso, endIso } = range;

  const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
  if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

  const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    await resolveUsageFilterContext({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: to,
    });

  const { buckets } = initDailyBuckets(dayKeys);
  const aggregateState = createAggregateUsageState({
    hasModelParam,
    defaultModel: DEFAULT_MODEL,
  });

  const ingestRow = (row) => {
    return accumulateAggregateUsageRow({
      state: aggregateState,
      row,
      effectiveDate: to,
    }).billable;
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
    distinctModels: aggregateState.distinctModels,
    distinctUsageModels: aggregateState.distinctUsageModels,
    pricingBuckets: aggregateState.pricingBuckets,
    effectiveDate: to,
    sourcesMap: aggregateState.sourcesMap,
    totals: aggregateState.totals,
    defaultModel: DEFAULT_MODEL,
  });
  const aggregatePayload = buildAggregateUsagePayload({
    totals: aggregateState.totals,
    pricingSummary,
    hasModelParam,
  });

  const rows = dayKeys.map((day) => {
    const bucket = buckets.get(day);
    return {
      day,
      ...usageMetricsCore.buildUsageBucketPayload(bucket),
    };
  });

  return respond(
    {
      from,
      to,
      ...aggregatePayload.selection,
      data: rows,
      summary: aggregatePayload.summary,
    },
    200,
    queryDurationMs,
  );
});
