import "./runtime-primitives-core.mjs";
import "./usage-model-core.mjs";

const CORE_KEY = "__vibeusageUsageFilterRequestCore";
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
const usageModelCore = globalThis.__vibeusageUsageModelCore;

if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
if (!usageModelCore) throw new Error("usage-model core not initialized");

function resolveUsageModelRequestParams({ url } = {}) {
  const modelResult = usageModelCore.getModelParam(url);
  if (!modelResult?.ok) {
    return { ok: false, status: 400, error: modelResult?.error || "Invalid model" };
  }

  return {
    ok: true,
    model: modelResult.model,
    hasModelParam: modelResult.model != null,
  };
}

function resolveUsageFilterRequestParams({ url } = {}) {
  const sourceResult = runtimePrimitivesCore.getSourceParam(url);
  if (!sourceResult?.ok) {
    return { ok: false, status: 400, error: sourceResult?.error || "Invalid source" };
  }

  const modelParams = resolveUsageModelRequestParams({ url });
  if (!modelParams?.ok) return modelParams;

  return {
    ok: true,
    source: sourceResult.source,
    model: modelParams.model,
    hasModelParam: modelParams.hasModelParam,
  };
}

async function resolveUsageFilterRequestContext({ edgeClient, model, effectiveDate } = {}) {
  const filterContext = await usageModelCore.resolveUsageFilterContext({
    edgeClient,
    canonicalModel: model,
    effectiveDate,
  });

  return {
    canonicalModel: filterContext.canonicalModel,
    usageModels: filterContext.usageModels,
    hasModelFilter: filterContext.hasModelFilter,
    aliasTimeline: filterContext.aliasTimeline,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      resolveUsageModelRequestParams,
      resolveUsageFilterRequestParams,
      resolveUsageFilterRequestContext,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
