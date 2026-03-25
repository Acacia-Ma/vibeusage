import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { collectAggregateUsageRange } from "./shared/core/usage-aggregate-collector.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
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
  resolveAggregateUsagePayload,
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

  const queryStartMs = Date.now();
  let rowCount = 0;
  const rollupHit = false;
  const aggregateRes = await collectAggregateUsageRange({
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    source,
    usageModels,
    canonicalModel,
    hasModelFilter,
    aliasTimeline,
    effectiveDate: to,
    startIso,
    endIso,
    state: aggregateState,
    shouldAccumulateRow: (row) => {
      const ts = row?.hour_start;
      if (!ts) return false;
      return Number.isFinite(new Date(ts).getTime());
    },
    onAccumulatedRow: ({ row, accumulation }) => {
      applyDailyBucket({ buckets, row, tzContext, billable: accumulation.billable });
    },
  });
  rowCount += aggregateRes.rowCount;
  if (aggregateRes.error) {
    return respond({ error: aggregateRes.error.message }, 500, Date.now() - queryStartMs);
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

  const { aggregatePayload } = await resolveAggregateUsagePayload({
    edgeClient: auth.edgeClient,
    canonicalModel,
    effectiveDate: to,
    state: aggregateState,
    hasModelParam,
    defaultModel: DEFAULT_MODEL,
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
