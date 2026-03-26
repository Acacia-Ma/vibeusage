import "./date-core.mjs";
import "./runtime-primitives-core.mjs";

const CORE_KEY = "__vibeusageUsageRangeRequestCore";
const dateCore = globalThis.__vibeusageDateCore;
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;

if (!dateCore) throw new Error("date core not initialized");
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

function resolveUsageRangeRequestContext({ url, tzContext } = {}) {
  const sourceResult = runtimePrimitivesCore.getSourceParam(url);
  if (!sourceResult?.ok) {
    return { ok: false, status: 400, error: sourceResult?.error || "Invalid source" };
  }

  const range = dateCore.resolveUsageDateRangeLocal({
    fromRaw: url?.searchParams?.get("from"),
    toRaw: url?.searchParams?.get("to"),
    tzContext,
  });
  if (!range?.ok) {
    return { ok: false, status: 400, error: range?.error || "Invalid date range" };
  }

  return {
    ok: true,
    source: sourceResult.source,
    from: range.from,
    to: range.to,
    dayKeys: range.dayKeys,
    startIso: range.startIso,
    endIso: range.endIso,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      resolveUsageRangeRequestContext,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
