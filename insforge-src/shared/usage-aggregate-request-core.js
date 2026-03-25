"use strict";

require("./date-core");
require("./runtime-primitives-core");
require("./usage-model-core");

const CORE_KEY = "__vibeusageUsageAggregateRequestCore";
const dateCore = globalThis.__vibeusageDateCore;
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
const usageModelCore = globalThis.__vibeusageUsageModelCore;

if (!dateCore) throw new Error("date core not initialized");
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
if (!usageModelCore) throw new Error("usage-model core not initialized");

async function resolveAggregateUsageRequestContext({
  url,
  tzContext,
  edgeClient,
  auth = null,
} = {}) {
  const sourceResult = runtimePrimitivesCore.getSourceParam(url);
  if (!sourceResult?.ok) {
    return { ok: false, status: 400, error: sourceResult?.error || "Invalid source" };
  }

  const modelResult = usageModelCore.getModelParam(url);
  if (!modelResult?.ok) {
    return { ok: false, status: 400, error: modelResult?.error || "Invalid model" };
  }

  const range = dateCore.resolveUsageDateRangeLocal({
    fromRaw: url?.searchParams?.get("from"),
    toRaw: url?.searchParams?.get("to"),
    tzContext,
  });
  if (!range?.ok) {
    return { ok: false, status: 400, error: range?.error || "Invalid date range" };
  }

  const { from, to, dayKeys, startIso, endIso } = range;
  const model = modelResult.model;
  const filterContext = await usageModelCore.resolveUsageFilterContext({
    edgeClient,
    canonicalModel: model,
    effectiveDate: to,
  });

  return {
    ok: true,
    auth,
    source: sourceResult.source,
    model,
    hasModelParam: model != null,
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
