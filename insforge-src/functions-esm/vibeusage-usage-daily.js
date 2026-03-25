import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { collectAggregateUsageRange } from "./shared/core/usage-aggregate-collector.js";
import { resolveAggregateUsageRequestContext } from "./shared/core/usage-aggregate-request.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
import { createUsageJsonResponder } from "./shared/core/usage-response.js";
import {
  getUsageTimeZoneContext,
} from "./shared/date.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import "../shared/usage-pricing-core.mjs";
import "../shared/usage-metrics-core.mjs";

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
  const respond = createUsageJsonResponder({ url, logger });

  if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

  const tzContext = getUsageTimeZoneContext(url);

  const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
  if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

  const requestContext = await resolveAggregateUsageRequestContext({
    url,
    tzContext,
    edgeClient: auth.edgeClient,
    auth,
  });
  if (!requestContext.ok) {
    return respond({ error: requestContext.error }, requestContext.status || 400, 0);
  }
  const {
    source,
    hasModelParam,
    from,
    to,
    dayKeys,
    startIso,
    endIso,
    canonicalModel,
    usageModels,
    hasModelFilter,
    aliasTimeline,
  } = requestContext;

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
