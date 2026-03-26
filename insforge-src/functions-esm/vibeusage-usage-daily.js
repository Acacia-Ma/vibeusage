import { collectAggregateUsageRange } from "./shared/core/usage-aggregate-collector.js";
import { resolveAggregateUsageRequestContext } from "./shared/core/usage-aggregate-request.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import {
  getUsageTimeZoneContext,
} from "./shared/date.js";
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
  const endpoint = prepareUsageEndpoint({ request, logger });
  if (!endpoint.ok) return endpoint.response;
  const { url, respond, bearer } = endpoint;

  const tzContext = getUsageTimeZoneContext(url);

  const access = await requireUsageAccess({ respond, bearer });
  if (!access.ok) return access.response;
  const { auth } = access;

  const requestContext = await resolveAggregateUsageRequestContext({
    url,
    tzContext,
    edgeClient: auth.edgeClient,
    auth,
  });
  if (!requestContext.ok) return respondUsageRequestError(respond, requestContext);
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
