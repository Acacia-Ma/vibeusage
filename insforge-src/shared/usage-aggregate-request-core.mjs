import "./usage-range-request-core.mjs";
import "./usage-filter-request-core.mjs";

const CORE_KEY = "__vibeusageUsageAggregateRequestCore";
const usageRangeRequestCore = globalThis.__vibeusageUsageRangeRequestCore;
const usageFilterRequestCore = globalThis.__vibeusageUsageFilterRequestCore;

if (!usageRangeRequestCore) throw new Error("usage range request core not initialized");
if (!usageFilterRequestCore) throw new Error("usage filter request core not initialized");

async function resolveAggregateUsageRequestContext({
  url,
  tzContext,
  edgeClient,
  auth = null,
} = {}) {
  const rangeContext = usageRangeRequestCore.resolveUsageRangeRequestContext({ url, tzContext });
  if (!rangeContext?.ok) return rangeContext;

  const modelParams = usageFilterRequestCore.resolveUsageModelRequestParams({ url });
  if (!modelParams?.ok) return modelParams;

  const { from, to, dayKeys, startIso, endIso } = rangeContext;
  const filterContext = await usageFilterRequestCore.resolveUsageFilterRequestContext({
    edgeClient,
    model: modelParams.model,
    effectiveDate: to,
  });

  return {
    ok: true,
    auth,
    source: rangeContext.source,
    model: modelParams.model,
    hasModelParam: modelParams.hasModelParam,
    from,
    to,
    dayKeys,
    startIso,
    endIso,
    canonicalModel: filterContext.canonicalModel,
    usageModels: filterContext.usageModels,
    hasModelFilter: filterContext.hasModelFilter,
    aliasTimeline: filterContext.aliasTimeline,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      resolveAggregateUsageRequestContext,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
