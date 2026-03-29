"use strict";

require("./runtime-primitives-core");
require("./usage-model-core");
require("./usage-metrics-core");

const CORE_KEY = "__vibeusageUsageRowCore";
const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

const { extractDateKey, normalizeUsageModel, normalizeUsageModelKey } = usageModelCore;
const { resolveBillableTotals } = usageMetricsCore;

function resolveHourlyUsageRowState({
  row,
  source,
  effectiveDate,
  defaultSource = DEFAULT_SOURCE,
  defaultModel = DEFAULT_MODEL,
  allowMissingTimestamp = false,
  useDefaultSourceForBilling = false,
} = {}) {
  const ts = row?.hour_start;
  let date = null;
  let dateKey = effectiveDate || null;
  if (ts) {
    date = new Date(ts);
    if (!Number.isFinite(date.getTime())) {
      if (!allowMissingTimestamp) return null;
      date = null;
    } else {
      dateKey = extractDateKey(ts) || effectiveDate || null;
    }
  } else if (!allowMissingTimestamp) {
    return null;
  }

  const sourceKey = runtimePrimitivesCore.normalizeSource(row?.source) || source || defaultSource;
  const billingSource =
    row?.source || source || (useDefaultSourceForBilling ? defaultSource : null);
  const normalizedModel = normalizeUsageModel(row?.model) || defaultModel;
  const usageKey = normalizeUsageModelKey(normalizedModel) || defaultModel;
  const { billable, hasStoredBillable } = resolveBillableTotals({ row, source: billingSource });

  return {
    billable,
    date,
    dateKey,
    hasStoredBillable,
    normalizedModel,
    sourceKey,
    timestamp: ts || null,
    usageKey,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      resolveHourlyUsageRowState,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
