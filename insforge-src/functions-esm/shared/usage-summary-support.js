import { applyCanaryFilter } from "./canary.js";
import { toBigInt } from "./numbers.js";
import { normalizeSource } from "./source.js";

const DEFAULT_MODEL = "unknown";
const MAX_PAGE_SIZE = 1000;
const BILLABLE_INPUT_OUTPUT_REASONING = new Set(["codex", "every-code"]);
const BILLABLE_ADD_ALL = new Set(["claude", "opencode"]);
const BILLABLE_TOTAL = new Set(["gemini"]);

export function normalizeModel(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeUsageModel(value) {
  const normalized = normalizeModel(value);
  return normalized ? normalized.toLowerCase() : null;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

export function applyUsageModelFilter(query, usageModels) {
  if (!query || typeof query.or !== "function") return query;
  const models = Array.isArray(usageModels) ? usageModels : [];
  const terms = [];
  const seen = new Set();
  for (const model of models) {
    const normalized = normalizeUsageModel(model);
    if (!normalized) continue;
    const exact = `model.ilike.${escapeLike(normalized)}`;
    if (seen.has(exact)) continue;
    seen.add(exact);
    terms.push(exact);
  }
  if (terms.length === 0) return query;
  return query.or(terms.join(","));
}

export function getModelParam(url) {
  if (!url || typeof url.searchParams?.get !== "function") {
    return { ok: false, error: "Invalid request URL" };
  }
  const raw = url.searchParams.get("model");
  if (raw == null || raw.trim() === "") return { ok: true, model: null };
  const normalized = normalizeUsageModel(raw);
  if (!normalized) return { ok: false, error: "Invalid model" };
  return { ok: true, model: normalized };
}

function normalizeDateKey(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
}

function nextDateKey(dateKey) {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function normalizeUsageModelKey(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeDisplayNameValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function buildIdentityMap({ usageModels, aliasRows } = {}) {
  const normalized = new Set();
  for (const model of Array.isArray(usageModels) ? usageModels : []) {
    const key = normalizeUsageModelKey(model);
    if (key) normalized.add(key);
  }
  const map = new Map();
  for (const row of Array.isArray(aliasRows) ? aliasRows : []) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    const canonical = normalizeUsageModelKey(row?.canonical_model);
    if (!usageKey || !canonical) continue;
    if (normalized.size > 0 && !normalized.has(usageKey)) continue;
    const display = normalizeDisplayNameValue(row?.display_name) || canonical;
    const effective = String(row?.effective_from || "");
    const existing = map.get(usageKey);
    if (!existing || effective > existing.effective_from) {
      map.set(usageKey, { model_id: canonical, model: display, effective_from: effective });
    }
  }
  for (const key of normalized) {
    if (!map.has(key)) map.set(key, { model_id: key, model: key, effective_from: "" });
  }
  const result = new Map();
  for (const [key, value] of map.entries()) {
    result.set(key, { model_id: value.model_id, model: value.model });
  }
  return result;
}

export function applyModelIdentity({ rawModel, identityMap } = {}) {
  const normalized = normalizeUsageModelKey(rawModel) || DEFAULT_MODEL;
  const entry = identityMap?.get?.(normalized) || null;
  if (entry) return { model_id: entry.model_id, model: entry.model };
  const display = normalizeDisplayNameValue(rawModel) || DEFAULT_MODEL;
  return { model_id: normalized, model: display };
}

export async function resolveModelIdentity({ edgeClient, usageModels, effectiveDate } = {}) {
  const models = Array.isArray(usageModels)
    ? usageModels.map(normalizeUsageModelKey).filter(Boolean)
    : [];
  if (!models.length) return new Map();
  if (!edgeClient?.database) return buildIdentityMap({ usageModels: models, aliasRows: [] });
  const dateKey = normalizeDateKey(effectiveDate) || new Date().toISOString().slice(0, 10);
  const dateKeyNext = nextDateKey(dateKey) || dateKey;
  const query = edgeClient.database
    .from("vibeusage_model_aliases")
    .select("usage_model,canonical_model,display_name,effective_from");
  if (
    !query ||
    typeof query.eq !== "function" ||
    typeof query.in !== "function" ||
    typeof query.lt !== "function" ||
    typeof query.order !== "function"
  ) {
    return buildIdentityMap({ usageModels: models, aliasRows: [] });
  }
  const result = await query
    .eq("active", true)
    .in("usage_model", models)
    .lt("effective_from", dateKeyNext)
    .order("effective_from", { ascending: false });
  if (result?.error || !Array.isArray(result?.data)) {
    return buildIdentityMap({ usageModels: models, aliasRows: [] });
  }
  return buildIdentityMap({ usageModels: models, aliasRows: result.data });
}

export async function resolveUsageModelsForCanonical({ edgeClient, canonicalModel, effectiveDate } = {}) {
  const canonical = normalizeUsageModelKey(canonicalModel);
  if (!canonical) return { canonical: null, usageModels: [] };
  if (!edgeClient?.database) return { canonical, usageModels: [canonical] };
  const dateKey = normalizeDateKey(effectiveDate) || new Date().toISOString().slice(0, 10);
  const dateKeyNext = nextDateKey(dateKey) || dateKey;
  const query = edgeClient.database
    .from("vibeusage_model_aliases")
    .select("usage_model,canonical_model,effective_from");
  if (
    !query ||
    typeof query.eq !== "function" ||
    typeof query.lt !== "function" ||
    typeof query.order !== "function"
  ) {
    return { canonical, usageModels: [canonical] };
  }
  const result = await query
    .eq("active", true)
    .eq("canonical_model", canonical)
    .lt("effective_from", dateKeyNext)
    .order("effective_from", { ascending: false });
  if (result?.error || !Array.isArray(result?.data)) {
    return { canonical, usageModels: [canonical] };
  }
  const usageMap = new Map();
  for (const row of result.data) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    if (!usageKey) continue;
    const effective = String(row?.effective_from || "");
    const existing = usageMap.get(usageKey);
    if (!existing || effective > existing) usageMap.set(usageKey, effective);
  }
  const usageModels = new Set([canonical]);
  for (const usageKey of usageMap.keys()) usageModels.add(usageKey);
  return { canonical, usageModels: Array.from(usageModels.values()) };
}

export function extractDateKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return null;
}

export function resolveIdentityAtDate({ rawModel, usageKey, dateKey, timeline } = {}) {
  const normalizedKey = usageKey || normalizeUsageModelKey(rawModel) || DEFAULT_MODEL;
  const normalizedDateKey = extractDateKey(dateKey) || dateKey || null;
  const entries = timeline?.get?.(normalizedKey) || null;
  if (Array.isArray(entries)) {
    let match = null;
    for (const entry of entries) {
      if (entry.effective_from && normalizedDateKey && entry.effective_from <= normalizedDateKey) {
        match = entry;
      } else if (entry.effective_from && normalizedDateKey && entry.effective_from > normalizedDateKey) {
        break;
      }
    }
    if (match) return { model_id: match.model_id, model: match.model };
  }
  const display = normalizeModel(rawModel) || DEFAULT_MODEL;
  return { model_id: normalizedKey, model: display };
}

export function buildAliasTimeline({ usageModels, aliasRows } = {}) {
  const normalized = new Set(
    Array.isArray(usageModels)
      ? usageModels.map((model) => normalizeUsageModelKey(model)).filter(Boolean)
      : [],
  );
  const timeline = new Map();
  for (const row of Array.isArray(aliasRows) ? aliasRows : []) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    const canonical = normalizeUsageModelKey(row?.canonical_model);
    if (!usageKey || !canonical) continue;
    if (normalized.size && !normalized.has(usageKey)) continue;
    const display = normalizeModel(row?.display_name) || canonical;
    const effective = extractDateKey(row?.effective_from || "");
    if (!effective) continue;
    const entry = { model_id: canonical, model: display, effective_from: effective };
    const list = timeline.get(usageKey);
    if (list) {
      list.push(entry);
    } else {
      timeline.set(usageKey, [entry]);
    }
  }
  for (const list of timeline.values()) {
    list.sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)));
  }
  return timeline;
}

export async function fetchAliasRows({ edgeClient, usageModels, effectiveDate } = {}) {
  const models = Array.isArray(usageModels)
    ? usageModels.map((model) => normalizeUsageModelKey(model)).filter(Boolean)
    : [];
  if (!models.length || !edgeClient?.database) return [];
  const dateKey = extractDateKey(effectiveDate) || new Date().toISOString().slice(0, 10);
  const dateKeyNext = nextDateKey(dateKey) || dateKey;
  const query = edgeClient.database
    .from("vibeusage_model_aliases")
    .select("usage_model,canonical_model,display_name,effective_from");
  if (
    !query ||
    typeof query.eq !== "function" ||
    typeof query.in !== "function" ||
    typeof query.lt !== "function" ||
    typeof query.order !== "function"
  ) {
    return [];
  }
  const result = await query
    .eq("active", true)
    .in("usage_model", models)
    .lt("effective_from", dateKeyNext)
    .order("effective_from", { ascending: true });
  if (result?.error || !Array.isArray(result?.data)) return [];
  return result.data;
}

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
