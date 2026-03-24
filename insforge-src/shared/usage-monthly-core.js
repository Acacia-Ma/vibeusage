"use strict";

const CORE_KEY = "__vibeusageUsageMonthlyCore";
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

const { addDatePartsMonths, getLocalParts } = dateCore;
const { toBigInt } = runtimePrimitivesCore;
const { normalizeUsageModel, extractDateKey, resolveIdentityAtDate } = usageModelCore;
const { resolveBillableTotals } = usageMetricsCore;

function initMonthlyBuckets({ startMonthParts, months } = {}) {
  const monthKeys = [];
  const buckets = new Map();
  const count = Number.isFinite(months) ? months : 0;
  for (let i = 0; i < count; i += 1) {
    const parts = addDatePartsMonths(startMonthParts, i);
    const key = `${parts.year}-${String(parts.month).padStart(2, "0")}`;
    monthKeys.push(key);
    buckets.set(key, {
      total: 0n,
      billable: 0n,
      input: 0n,
      cached: 0n,
      output: 0n,
      reasoning: 0n,
    });
  }
  return { monthKeys, buckets };
}

function ingestMonthlyRow({
  buckets,
  row,
  tzContext,
  source,
  canonicalModel,
  hasModelFilter,
  aliasTimeline,
  to,
} = {}) {
  const ts = row?.hour_start;
  if (!ts) return false;
  const dt = new Date(ts);
  if (!Number.isFinite(dt.getTime())) return false;

  if (hasModelFilter) {
    const rawModel = normalizeUsageModel(row?.model);
    const dateKey = extractDateKey(ts) || to;
    const identity = resolveIdentityAtDate({ rawModel, dateKey, timeline: aliasTimeline });
    const filterIdentity = resolveIdentityAtDate({
      rawModel: canonicalModel,
      usageKey: canonicalModel,
      dateKey,
      timeline: aliasTimeline,
    });
    if (identity.model_id !== filterIdentity.model_id) return false;
  }

  const localParts = getLocalParts(dt, tzContext);
  const key = `${localParts.year}-${String(localParts.month).padStart(2, "0")}`;
  const bucket = buckets?.get?.(key) || null;
  if (!bucket) return false;

  bucket.total += toBigInt(row?.total_tokens);
  const { billable } = resolveBillableTotals({ row, source: row?.source || source });
  bucket.billable += billable;
  bucket.input += toBigInt(row?.input_tokens);
  bucket.cached += toBigInt(row?.cached_input_tokens);
  bucket.output += toBigInt(row?.output_tokens);
  bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
  return true;
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      initMonthlyBuckets,
      ingestMonthlyRow,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
