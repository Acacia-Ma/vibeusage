import "../env.js";
import "../../../shared/usage-pricing-core.mjs";
import { resolveAggregateUsageRequestContext } from "./usage-aggregate-request.js";
import { collectAggregateUsageRange } from "./usage-aggregate-collector.js";
import { logSlowQuery } from "../logging.js";

const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) {
  throw new Error("usage pricing core not initialized");
}

const {
  createAggregateUsageState,
  resolveAggregateUsagePayload,
} = usagePricingCore;

export async function startAggregateUsageRequest({
  url,
  tzContext,
  edgeClient,
  auth,
  defaultModel = "unknown",
  defaultSource = "codex",
  onResolvedRequestContext,
  shouldAccumulateRow,
  onAccumulatedRow,
  preferRollup = false,
} = {}) {
  const requestContext = await resolveAggregateUsageRequestContext({
    url,
    tzContext,
    edgeClient,
    auth,
  });
  if (!requestContext?.ok) {
    return {
      ok: false,
      kind: "request",
      result: requestContext,
    };
  }
  if (typeof onResolvedRequestContext === "function") {
    await onResolvedRequestContext(requestContext);
  }

  const aggregateState = createAggregateUsageState({
    hasModelParam: requestContext.hasModelParam,
    defaultModel,
  });
  const createState = () =>
    createAggregateUsageState({
      hasModelParam: requestContext.hasModelParam,
      defaultModel,
    });
  const queryStartMs = Date.now();
  const aggregateRes = await collectAggregateUsageRange({
    edgeClient,
    userId: auth?.userId,
    source: requestContext.source,
    usageModels: requestContext.usageModels,
    canonicalModel: requestContext.canonicalModel,
    hasModelFilter: requestContext.hasModelFilter,
    aliasTimeline: requestContext.aliasTimeline,
    effectiveDate: requestContext.to,
    startIso: requestContext.startIso,
    endIso: requestContext.endIso,
    state: aggregateState,
    createState,
    defaultSource,
    shouldAccumulateRow,
    onAccumulatedRow,
    preferRollup,
  });
  if (aggregateRes.error) {
    return {
      ok: false,
      kind: "query",
      error: aggregateRes.error,
      queryStartMs,
      rowCount: aggregateRes.rowCount,
      requestContext,
      aggregateState: aggregateRes.state,
    };
  }

  return {
    ok: true,
    requestContext,
    aggregateState: aggregateRes.state,
    queryStartMs,
    rowCount: aggregateRes.rowCount,
    rollupHit: aggregateRes.rollupHit,
  };
}

export async function finishAggregateUsageRequest({
  edgeClient,
  requestContext,
  aggregateState,
  tzContext,
  logger,
  queryLabel,
  queryStartMs,
  rowCount = 0,
  defaultModel = "unknown",
  rollupHit = false,
} = {}) {
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: queryLabel,
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: requestContext?.dayKeys?.length || 0,
    source: requestContext?.source || null,
    model: requestContext?.canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: rollupHit,
  });

  const { aggregatePayload } = await resolveAggregateUsagePayload({
    edgeClient,
    canonicalModel: requestContext?.canonicalModel,
    effectiveDate: requestContext?.to,
    state: aggregateState,
    hasModelParam: requestContext?.hasModelParam,
    defaultModel,
  });

  return {
    aggregatePayload,
    queryDurationMs,
  };
}
