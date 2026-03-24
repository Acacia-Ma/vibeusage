"use strict";

const CORE_KEY = "__vibeusageUsageModelCore";
const DEFAULT_MODEL = "unknown";

function normalizeModel(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUsageModel(value) {
  const normalized = normalizeModel(value);
  return normalized ? normalized.toLowerCase() : null;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function applyUsageModelFilter(query, usageModels) {
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

function getModelParam(url) {
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

function extractDateKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return null;
}

function nextDateKey(dateKey) {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeUsageModelKey(value) {
  return normalizeUsageModel(value);
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
    if (!map.has(key)) {
      map.set(key, { model_id: key, model: key, effective_from: "" });
    }
  }

  const result = new Map();
  for (const [key, value] of map.entries()) {
    result.set(key, { model_id: value.model_id, model: value.model });
  }
  return result;
}

function applyModelIdentity({ rawModel, identityMap } = {}) {
  const normalized = normalizeUsageModelKey(rawModel) || DEFAULT_MODEL;
  const entry =
    identityMap && typeof identityMap.get === "function" ? identityMap.get(normalized) : null;
  if (entry) return { model_id: entry.model_id, model: entry.model };
  const display = normalizeDisplayNameValue(rawModel) || DEFAULT_MODEL;
  return { model_id: normalized, model: display };
}

function readQueryOutcome(result, query) {
  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(query?.data)
      ? query.data
      : null;
  const error = result?.error || query?.error || null;
  return { data, error };
}

async function resolveModelIdentity({ edgeClient, usageModels, effectiveDate } = {}) {
  const models = Array.isArray(usageModels)
    ? usageModels.map(normalizeUsageModelKey).filter(Boolean)
    : [];
  if (!models.length) return new Map();

  const database = edgeClient?.database;
  if (!database || typeof database.from !== "function") {
    return buildIdentityMap({ usageModels: models, aliasRows: [] });
  }

  const dateKey = normalizeDateKey(effectiveDate) || new Date().toISOString().slice(0, 10);
  const dateKeyNext = nextDateKey(dateKey) || dateKey;
  const query = database
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
  const { data, error } = readQueryOutcome(result, query);
  if (error || !Array.isArray(data)) {
    return buildIdentityMap({ usageModels: models, aliasRows: [] });
  }
  return buildIdentityMap({ usageModels: models, aliasRows: data });
}

async function resolveUsageModelsForCanonical({ edgeClient, canonicalModel, effectiveDate } = {}) {
  const canonical = normalizeUsageModelKey(canonicalModel);
  if (!canonical) return { canonical: null, usageModels: [] };

  const database = edgeClient?.database;
  if (!database || typeof database.from !== "function") {
    return { canonical, usageModels: [canonical] };
  }

  const dateKey = normalizeDateKey(effectiveDate) || new Date().toISOString().slice(0, 10);
  const dateKeyNext = nextDateKey(dateKey) || dateKey;
  const query = database
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
  const { data, error } = readQueryOutcome(result, query);
  if (error || !Array.isArray(data)) {
    return { canonical, usageModels: [canonical] };
  }

  const usageMap = new Map();
  for (const row of data) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    if (!usageKey) continue;
    const effective = String(row?.effective_from || "");
    const existing = usageMap.get(usageKey);
    if (!existing || effective > existing) usageMap.set(usageKey, effective);
  }

  const usageModelsSet = new Set([canonical]);
  for (const usageKey of usageMap.keys()) {
    usageModelsSet.add(usageKey);
  }

  return { canonical, usageModels: Array.from(usageModelsSet.values()) };
}

function resolveIdentityAtDate({ rawModel, usageKey, dateKey, timeline } = {}) {
  const normalizedKey = usageKey || normalizeUsageModelKey(rawModel) || DEFAULT_MODEL;
  const normalizedDateKey = extractDateKey(dateKey) || dateKey || null;
  const entries =
    timeline && typeof timeline.get === "function" ? timeline.get(normalizedKey) : null;
  if (Array.isArray(entries)) {
    let match = null;
    for (const entry of entries) {
      if (entry.effective_from && normalizedDateKey && entry.effective_from <= normalizedDateKey) {
        match = entry;
      } else if (
        entry.effective_from &&
        normalizedDateKey &&
        entry.effective_from > normalizedDateKey
      ) {
        break;
      }
    }
    if (match) return { model_id: match.model_id, model: match.model };
  }
  const display = normalizeModel(rawModel) || DEFAULT_MODEL;
  return { model_id: normalizedKey, model: display };
}

function matchesCanonicalModelAtDate({ rawModel, canonicalModel, dateKey, timeline } = {}) {
  if (!canonicalModel) return true;
  const identity = resolveIdentityAtDate({ rawModel, dateKey, timeline });
  const filterIdentity = resolveIdentityAtDate({
    rawModel: canonicalModel,
    usageKey: canonicalModel,
    dateKey,
    timeline,
  });
  return identity.model_id === filterIdentity.model_id;
}

function buildAliasTimeline({ usageModels, aliasRows } = {}) {
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
    if (normalized.size > 0 && !normalized.has(usageKey)) continue;
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

async function fetchAliasRows({ edgeClient, usageModels, effectiveDate } = {}) {
  const models = Array.isArray(usageModels)
    ? usageModels.map((model) => normalizeUsageModelKey(model)).filter(Boolean)
    : [];
  const database = edgeClient?.database;
  if (!models.length || !database || typeof database.from !== "function") return [];

  const dateKey = extractDateKey(effectiveDate) || new Date().toISOString().slice(0, 10);
  const dateKeyNext = nextDateKey(dateKey) || dateKey;
  const query = database
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
  const { data, error } = readQueryOutcome(result, query);
  if (error || !Array.isArray(data)) return [];
  return data;
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      normalizeModel,
      normalizeUsageModel,
      applyUsageModelFilter,
      getModelParam,
      normalizeDateKey,
      extractDateKey,
      normalizeUsageModelKey,
      buildIdentityMap,
      applyModelIdentity,
      resolveModelIdentity,
      resolveUsageModelsForCanonical,
      resolveIdentityAtDate,
      matchesCanonicalModelAtDate,
      buildAliasTimeline,
      fetchAliasRows,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
