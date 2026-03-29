"use strict";

require("./usage-range-request-core");
require("./usage-filter-request-core");

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

  const { from, to, dayKeys, startIso, endIso } = rangeContext;
  const filterSnapshot = await usageFilterRequestCore.resolveUsageFilterRequestSnapshot({
    url,
    edgeClient,
    effectiveDate: to,
  });
  if (!filterSnapshot?.ok) return filterSnapshot;

  return {
    ok: true,
    auth,
    source: filterSnapshot.source,
    model: filterSnapshot.model,
    hasModelParam: filterSnapshot.hasModelParam,
    from,
    to,
    dayKeys,
    startIso,
    endIso,
    canonicalModel: filterSnapshot.canonicalModel,
    usageModels: filterSnapshot.usageModels,
    hasModelFilter: filterSnapshot.hasModelFilter,
    aliasTimeline: filterSnapshot.aliasTimeline,
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
