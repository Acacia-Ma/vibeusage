import "./date-core.mjs";
import "./usage-filter-request-core.mjs";

const CORE_KEY = "__vibeusageUsageAggregateRequestCore";
const dateCore = globalThis.__vibeusageDateCore;
const usageFilterRequestCore = globalThis.__vibeusageUsageFilterRequestCore;

if (!dateCore) throw new Error("date core not initialized");
if (!usageFilterRequestCore) throw new Error("usage filter request core not initialized");

async function resolveAggregateUsageRequestContext({
  url,
  tzContext,
  edgeClient,
  auth = null,
} = {}) {
  const requestParams = usageFilterRequestCore.resolveUsageFilterRequestParams({ url });
  if (!requestParams?.ok) return requestParams;

  const range = dateCore.resolveUsageDateRangeLocal({
    fromRaw: url?.searchParams?.get("from"),
    toRaw: url?.searchParams?.get("to"),
    tzContext,
  });
  if (!range?.ok) {
    return { ok: false, status: 400, error: range?.error || "Invalid date range" };
  }

  const { from, to, dayKeys, startIso, endIso } = range;
  const filterContext = await usageFilterRequestCore.resolveUsageFilterRequestContext({
    edgeClient,
    model: requestParams.model,
    effectiveDate: to,
  });

  return {
    ok: true,
    auth,
    source: requestParams.source,
    model: requestParams.model,
    hasModelParam: requestParams.hasModelParam,
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
