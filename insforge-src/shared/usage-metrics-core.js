"use strict";

const CORE_KEY = "__vibeusageUsageMetricsCore";
const BILLABLE_INPUT_OUTPUT_REASONING = new Set(["codex", "every-code"]);
const BILLABLE_ADD_ALL = new Set(["claude", "opencode"]);
const BILLABLE_TOTAL = new Set(["gemini"]);
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

function createTotals() {
  return {
    total_tokens: 0n,
    billable_total_tokens: 0n,
    input_tokens: 0n,
    cached_input_tokens: 0n,
    output_tokens: 0n,
    reasoning_output_tokens: 0n,
  };
}

function addRowTotals(target, row) {
  if (!target || !row) return;
  target.total_tokens += runtimePrimitivesCore.toBigInt(row?.total_tokens);
  target.billable_total_tokens += runtimePrimitivesCore.toBigInt(row?.billable_total_tokens);
  target.input_tokens += runtimePrimitivesCore.toBigInt(row?.input_tokens);
  target.cached_input_tokens += runtimePrimitivesCore.toBigInt(row?.cached_input_tokens);
  target.output_tokens += runtimePrimitivesCore.toBigInt(row?.output_tokens);
  target.reasoning_output_tokens += runtimePrimitivesCore.toBigInt(row?.reasoning_output_tokens);
}

function computeBillableTotalTokens({ source, totals } = {}) {
  const normalizedSource = runtimePrimitivesCore.normalizeSource(source) || "unknown";
  const input = runtimePrimitivesCore.toBigInt(totals?.input_tokens);
  const cached = runtimePrimitivesCore.toBigInt(totals?.cached_input_tokens);
  const output = runtimePrimitivesCore.toBigInt(totals?.output_tokens);
  const reasoning = runtimePrimitivesCore.toBigInt(totals?.reasoning_output_tokens);
  const total = runtimePrimitivesCore.toBigInt(totals?.total_tokens);
  const hasTotal = Boolean(totals && Object.prototype.hasOwnProperty.call(totals, "total_tokens"));

  if (BILLABLE_TOTAL.has(normalizedSource)) return total;
  if (BILLABLE_ADD_ALL.has(normalizedSource)) return input + cached + output + reasoning;
  if (BILLABLE_INPUT_OUTPUT_REASONING.has(normalizedSource)) return input + output + reasoning;
  if (hasTotal) return total;
  return input + output + reasoning;
}

function resolveBillableTotals({
  row,
  source,
  totals,
  billableField = "billable_total_tokens",
  hasStoredBillable,
} = {}) {
  const stored =
    typeof hasStoredBillable === "boolean"
      ? hasStoredBillable
      : Boolean(
          row &&
            Object.prototype.hasOwnProperty.call(row, billableField) &&
            row[billableField] != null,
        );
  const resolvedTotals = totals || row;
  const billable = stored
    ? runtimePrimitivesCore.toBigInt(row?.[billableField])
    : computeBillableTotalTokens({ source, totals: resolvedTotals });
  return { billable, hasStoredBillable: stored };
}

function applyTotalsAndBillable({ totals, row, billable, hasStoredBillable } = {}) {
  if (!totals || !row) return;
  addRowTotals(totals, row);
  if (!hasStoredBillable) {
    totals.billable_total_tokens += runtimePrimitivesCore.toBigInt(billable);
  }
}

function getSourceEntry(map, source) {
  if (map.has(source)) return map.get(source);
  const entry = { source, totals: createTotals() };
  map.set(source, entry);
  return entry;
}

function resolveDisplayName(identityMap, modelId) {
  if (!modelId || !identityMap || typeof identityMap.values !== "function") return modelId || null;
  for (const entry of identityMap.values()) {
    if (entry?.model_id === modelId && entry?.model) return entry.model;
  }
  return modelId;
}

function deriveDisplayModel(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parts = text.split("/").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : text;
}

function buildPricingBucketKey(sourceKey, usageKey, dateKey) {
  return JSON.stringify([sourceKey || "", usageKey || "", dateKey || ""]);
}

function parsePricingBucketKey(bucketKey, defaultDate) {
  if (typeof bucketKey === "string" && bucketKey.startsWith("[")) {
    try {
      const parsed = JSON.parse(bucketKey);
      if (Array.isArray(parsed)) {
        const usageKey = parsed[1] ?? parsed[0] ?? "";
        const dateKey = parsed[2] ?? defaultDate;
        return { usageKey: String(usageKey || ""), dateKey: String(dateKey || defaultDate) };
      }
    } catch (_error) {}
  }
  if (typeof bucketKey === "string") {
    const parts = bucketKey.split("::");
    if (parts.length >= 3) return { usageKey: parts[1], dateKey: parts[2] || defaultDate };
    if (parts.length === 2) return { usageKey: parts[0], dateKey: parts[1] || defaultDate };
    return { usageKey: bucketKey, dateKey: defaultDate };
  }
  return { usageKey: bucketKey, dateKey: defaultDate };
}

function buildUsageTotalsPayload(totals, extra) {
  const payload = {
    total_tokens: runtimePrimitivesCore.toBigInt(totals?.total_tokens).toString(),
    billable_total_tokens: runtimePrimitivesCore.toBigInt(totals?.billable_total_tokens).toString(),
    input_tokens: runtimePrimitivesCore.toBigInt(totals?.input_tokens).toString(),
    cached_input_tokens: runtimePrimitivesCore.toBigInt(totals?.cached_input_tokens).toString(),
    output_tokens: runtimePrimitivesCore.toBigInt(totals?.output_tokens).toString(),
    reasoning_output_tokens: runtimePrimitivesCore.toBigInt(totals?.reasoning_output_tokens).toString(),
  };
  return extra && typeof extra === "object" ? { ...payload, ...extra } : payload;
}

function buildUsageBucketPayload(bucket, extra) {
  return buildUsageTotalsPayload(
    {
      total_tokens: bucket?.total,
      billable_total_tokens: bucket?.billable,
      input_tokens: bucket?.input,
      cached_input_tokens: bucket?.cached,
      output_tokens: bucket?.output,
      reasoning_output_tokens: bucket?.reasoning,
    },
    extra,
  );
}

const coreValue = {
  createTotals,
  addRowTotals,
  computeBillableTotalTokens,
  resolveBillableTotals,
  applyTotalsAndBillable,
  getSourceEntry,
  resolveDisplayName,
  deriveDisplayModel,
  buildPricingBucketKey,
  parsePricingBucketKey,
  buildUsageTotalsPayload,
  buildUsageBucketPayload,
};

if (globalThis[CORE_KEY] && typeof globalThis[CORE_KEY] === "object") {
  Object.assign(globalThis[CORE_KEY], coreValue);
} else {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: coreValue,
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
