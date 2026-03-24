"use strict";

const CORE_KEY = "__vibeusageUsageMetricsCore";
const BILLABLE_INPUT_OUTPUT_REASONING = new Set(["codex", "every-code"]);
const BILLABLE_ADD_ALL = new Set(["claude", "opencode"]);
const BILLABLE_TOTAL = new Set(["gemini"]);
const MAX_SOURCE_LENGTH = 64;

function toBigInt(value) {
  if (typeof value === "bigint") return value >= 0n ? value : 0n;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return BigInt(Math.floor(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return 0n;
    try {
      return BigInt(trimmed);
    } catch (_error) {
      return 0n;
    }
  }
  return 0n;
}

function normalizeSource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length > MAX_SOURCE_LENGTH) return normalized.slice(0, MAX_SOURCE_LENGTH);
  return normalized;
}

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
  target.total_tokens += toBigInt(row?.total_tokens);
  target.billable_total_tokens += toBigInt(row?.billable_total_tokens);
  target.input_tokens += toBigInt(row?.input_tokens);
  target.cached_input_tokens += toBigInt(row?.cached_input_tokens);
  target.output_tokens += toBigInt(row?.output_tokens);
  target.reasoning_output_tokens += toBigInt(row?.reasoning_output_tokens);
}

function computeBillableTotalTokens({ source, totals } = {}) {
  const normalizedSource = normalizeSource(source) || "unknown";
  const input = toBigInt(totals?.input_tokens);
  const cached = toBigInt(totals?.cached_input_tokens);
  const output = toBigInt(totals?.output_tokens);
  const reasoning = toBigInt(totals?.reasoning_output_tokens);
  const total = toBigInt(totals?.total_tokens);
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
    ? toBigInt(row?.[billableField])
    : computeBillableTotalTokens({ source, totals: resolvedTotals });
  return { billable, hasStoredBillable: stored };
}

function applyTotalsAndBillable({ totals, row, billable, hasStoredBillable } = {}) {
  if (!totals || !row) return;
  addRowTotals(totals, row);
  if (!hasStoredBillable) {
    totals.billable_total_tokens += toBigInt(billable);
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

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      createTotals,
      addRowTotals,
      computeBillableTotalTokens,
      resolveBillableTotals,
      applyTotalsAndBillable,
      getSourceEntry,
      resolveDisplayName,
      buildPricingBucketKey,
      parsePricingBucketKey,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
