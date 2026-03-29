import {
  finishAggregateUsageRequest,
  startAggregateUsageRequest,
} from "./shared/core/usage-aggregate.js";
import { applyDailyBucket, initDailyBuckets } from "./shared/core/usage-daily.js";
import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import {
  getUsageTimeZoneContext,
} from "./shared/date.js";
import { withRequestLogging } from "./shared/logging.js";
import "../shared/usage-metrics-core.mjs";

const DEFAULT_MODEL = "unknown";
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

  let buckets = null;
  const aggregateExecution = await startAggregateUsageRequest({
    url,
    tzContext,
    edgeClient: auth.edgeClient,
    auth,
    defaultModel: DEFAULT_MODEL,
    onResolvedRequestContext: (requestContext) => {
      buckets = initDailyBuckets(requestContext.dayKeys).buckets;
    },
    shouldAccumulateRow: (row) => {
      const ts = row?.hour_start;
      if (!ts) return false;
      return Number.isFinite(new Date(ts).getTime());
    },
    onAccumulatedRow: ({ row, accumulation }) => {
      applyDailyBucket({ buckets, row, tzContext, billable: accumulation.billable });
    },
  });
  if (!aggregateExecution.ok) {
    if (aggregateExecution.kind === "request") {
      return respondUsageRequestError(respond, aggregateExecution.result);
    }
    return respond({ error: aggregateExecution.error.message }, 500, Date.now() - aggregateExecution.queryStartMs);
  }
  const { requestContext, aggregateState, queryStartMs, rowCount } = aggregateExecution;
  const { from, to, dayKeys } = requestContext;

  const { aggregatePayload, queryDurationMs } = await finishAggregateUsageRequest({
    edgeClient: auth.edgeClient,
    requestContext,
    aggregateState,
    tzContext,
    logger,
    queryLabel: "usage_daily",
    queryStartMs,
    rowCount,
    defaultModel: DEFAULT_MODEL,
    rollupHit: false,
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
