import { applyCanaryFilter } from "./canary.js";
import { toBigInt } from "./numbers.js";
import { normalizeSource } from "./source.js";
import "../../shared/usage-model-core.mjs";

const DEFAULT_MODEL = "unknown";
const MAX_PAGE_SIZE = 1000;
const BILLABLE_INPUT_OUTPUT_REASONING = new Set(["codex", "every-code"]);
const BILLABLE_ADD_ALL = new Set(["claude", "opencode"]);
const BILLABLE_TOTAL = new Set(["gemini"]);

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

export const normalizeModel = usageModelCore.normalizeModel;
export const normalizeUsageModel = usageModelCore.normalizeUsageModel;
export const applyUsageModelFilter = usageModelCore.applyUsageModelFilter;
export const getModelParam = usageModelCore.getModelParam;
export const normalizeUsageModelKey = usageModelCore.normalizeUsageModelKey;
export const applyModelIdentity = usageModelCore.applyModelIdentity;
export const resolveModelIdentity = usageModelCore.resolveModelIdentity;
export const resolveUsageModelsForCanonical = usageModelCore.resolveUsageModelsForCanonical;
export const extractDateKey = usageModelCore.extractDateKey;
export const resolveIdentityAtDate = usageModelCore.resolveIdentityAtDate;
export const buildAliasTimeline = usageModelCore.buildAliasTimeline;
export const fetchAliasRows = usageModelCore.fetchAliasRows;

export async function forEachPage({ createQuery, pageSize, onPage }) {
  if (typeof createQuery !== "function") throw new Error("createQuery must be a function");
  if (typeof onPage !== "function") throw new Error("onPage must be a function");
  const size = normalizePageSize(pageSize);
  let offset = 0;
  while (true) {
    const query = createQuery();
    if (!query || typeof query.range !== "function") {
      const { data, error } = await query;
      if (error) return { error };
      const rows = Array.isArray(data) ? data : [];
      if (rows.length) await onPage(rows);
      return { error: null };
    }
    const { data, error } = await query.range(offset, offset + size - 1);
    if (error) return { error };
    const rows = Array.isArray(data) ? data : [];
    if (rows.length) await onPage(rows);
    if (rows.length < size) break;
    offset += size;
  }
  return { error: null };
}

function normalizePageSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return MAX_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(size));
}

export function createTotals() {
  return {
    total_tokens: 0n,
    billable_total_tokens: 0n,
    input_tokens: 0n,
    cached_input_tokens: 0n,
    output_tokens: 0n,
    reasoning_output_tokens: 0n,
  };
}

export function addRowTotals(target, row) {
  if (!target || !row) return;
  target.total_tokens += toBigInt(row?.total_tokens);
  target.billable_total_tokens += toBigInt(row?.billable_total_tokens);
  target.input_tokens += toBigInt(row?.input_tokens);
  target.cached_input_tokens += toBigInt(row?.cached_input_tokens);
  target.output_tokens += toBigInt(row?.output_tokens);
  target.reasoning_output_tokens += toBigInt(row?.reasoning_output_tokens);
}

export async function fetchRollupRows({ edgeClient, userId, fromDay, toDay, source, model }) {
  const rows = [];
  const { error } = await forEachPage({
    createQuery: () => {
      let query = edgeClient.database
        .from("vibeusage_tracker_daily_rollup")
        .select(
          "day,source,model,total_tokens,billable_total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
        )
        .eq("user_id", userId)
        .gte("day", fromDay)
        .lte("day", toDay);
      if (source) query = query.eq("source", source);
      if (model) query = query.eq("model", model);
      query = applyCanaryFilter(query, { source, model });
      return query
        .order("day", { ascending: true })
        .order("source", { ascending: true })
        .order("model", { ascending: true });
    },
    onPage: (pageRows) => {
      if (Array.isArray(pageRows) && pageRows.length > 0) rows.push(...pageRows);
    },
  });
  if (error) return { ok: false, error };
  return { ok: true, rows };
}

export function isRollupEnabled() {
  return false;
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

export function resolveBillableTotals({
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

export function applyTotalsAndBillable({ totals, row, billable, hasStoredBillable } = {}) {
  if (!totals || !row) return;
  addRowTotals(totals, row);
  if (!hasStoredBillable) {
    totals.billable_total_tokens += toBigInt(billable);
  }
}

export function getSourceEntry(map, source) {
  if (map.has(source)) return map.get(source);
  const entry = { source, totals: createTotals() };
  map.set(source, entry);
  return entry;
}

export function resolveDisplayName(identityMap, modelId) {
  if (!modelId || !identityMap || typeof identityMap.values !== "function") return modelId || null;
  for (const entry of identityMap.values()) {
    if (entry?.model_id === modelId && entry?.model) return entry.model;
  }
  return modelId;
}

export function buildPricingBucketKey(sourceKey, usageKey, dateKey) {
  return JSON.stringify([sourceKey || "", usageKey || "", dateKey || ""]);
}

export function parsePricingBucketKey(bucketKey, defaultDate) {
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
