// Edge function: vibeusage-pricing-sync
// Fetches OpenRouter Models API pricing and upserts into vibeusage_pricing_profiles.
// Auth: Authorization: Bearer <service_role_key>

import { getBearerToken } from "./shared/auth.js";
import { applyCanaryFilter } from "./shared/canary.js";
import { formatDateUTC, isDate } from "./shared/date.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, readJson, requireMethod } from "./shared/http.js";
import { createEdgeClient } from "./shared/insforge-client.js";
import { withRequestLogging } from "./shared/logging.js";
import { normalizeModel, normalizeUsageModel } from "./shared/model.js";
import { toPositiveIntOrNull } from "./shared/numbers.js";
import { forEachPage } from "./shared/pagination.js";
import { normalizeSource } from "./shared/source.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const MAX_RATE_MICROS_PER_MILLION = 2147483647n;
const SCALE_MICROS_PER_MILLION = 12; // USD per token -> micro USD per million tokens
const UPSERT_BATCH_SIZE = 500;
const USAGE_MODEL_WINDOW_DAYS = 30;

const handler = withRequestLogging("vibeusage-pricing-sync", async function (request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: "Admin key missing" }, 500);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer || bearer !== serviceRoleKey) return json({ error: "Unauthorized" }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const payload = body.data && typeof body.data === "object" ? body.data : {};

  const effectiveFrom = isDate(payload.effective_from)
    ? payload.effective_from
    : formatDateUTC(new Date());

  const retentionDays = toPositiveIntOrNull(payload.retention_days);

  const allowModels = normalizeAllowList(payload.allow_models);

  const pricingSource =
    normalizeSource(payload.source) ||
    normalizeSource(getEnvValue("VIBEUSAGE_PRICING_SOURCE")) ||
    "openrouter";

  const openRouterKey = getEnvValue("OPENROUTER_API_KEY");
  if (!openRouterKey) return json({ error: "OPENROUTER_API_KEY missing" }, 500);

  const headers = {
    Authorization: `Bearer ${openRouterKey}`,
  };
  const referer = getEnvValue("OPENROUTER_HTTP_REFERER");
  if (referer) headers["HTTP-Referer"] = referer;
  const title = getEnvValue("OPENROUTER_APP_TITLE");
  if (title) headers["X-Title"] = title;

  const openrouterRes = await logger.fetch(OPENROUTER_MODELS_URL, { headers });
  if (!openrouterRes.ok) {
    return json(
      {
        error: "OpenRouter fetch failed",
        status: openrouterRes.status,
      },
      502,
    );
  }

  let openrouterJson = null;
  try {
    openrouterJson = await openrouterRes.json();
  } catch (_err) {
    return json({ error: "Invalid OpenRouter response" }, 502);
  }

  const models = Array.isArray(openrouterJson?.data) ? openrouterJson.data : [];
  if (!Array.isArray(openrouterJson?.data)) {
    return json({ error: "Unexpected OpenRouter response shape" }, 502);
  }

  const rows = [];
  const pricingMeta = [];
  const pricingModelIds = new Set();
  let skipped = 0;

  for (const entry of models) {
    const modelId = normalizeModel(entry?.id);
    if (!modelId) {
      skipped += 1;
      continue;
    }
    if (!allowModel(modelId, allowModels)) continue;

    const pricing = entry?.pricing;
    if (!pricing || typeof pricing !== "object") {
      skipped += 1;
      continue;
    }

    const promptUsd = pricing.prompt;
    const completionUsd = pricing.completion;
    const cachedUsd = pricing.input_cache_read != null ? pricing.input_cache_read : promptUsd;
    const reasoningUsd =
      pricing.internal_reasoning != null ? pricing.internal_reasoning : completionUsd;

    const inputRate = toRateMicrosPerMillion(promptUsd);
    const outputRate = toRateMicrosPerMillion(completionUsd);
    const cachedRate = toRateMicrosPerMillion(cachedUsd);
    const reasoningRate = toRateMicrosPerMillion(reasoningUsd);

    if (inputRate == null || outputRate == null || cachedRate == null || reasoningRate == null) {
      skipped += 1;
      continue;
    }

    rows.push({
      model: modelId,
      source: pricingSource,
      effective_from: effectiveFrom,
      input_rate_micro_per_million: inputRate,
      cached_input_rate_micro_per_million: cachedRate,
      output_rate_micro_per_million: outputRate,
      reasoning_output_rate_micro_per_million: reasoningRate,
      active: true,
    });

    pricingModelIds.add(modelId.toLowerCase());
    pricingMeta.push({
      id: modelId,
      created: normalizeCreated(entry?.created),
      context_length: normalizeContextLength(entry?.context_length),
    });
  }

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const serviceClient = await createEdgeClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });

  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await serviceClient.database
      .from("vibeusage_pricing_profiles")
      .upsert(batch, { onConflict: "model,source,effective_from" });
    if (error) return json({ error: error.message }, 500);
    upserted += batch.length;
  }

  const usageModels = await listUsageModels({
    serviceClient,
    windowDays: USAGE_MODEL_WINDOW_DAYS,
  });
  const existingAliasRows = await listExistingAliases({
    serviceClient,
    usageModels,
    pricingSource,
    effectiveFrom,
  });

  const aliasRows = buildAliasRows({
    usageModels,
    pricingModelIds,
    pricingMeta,
    pricingSource,
    effectiveFrom,
    existingAliasMap: buildExistingAliasMap(existingAliasRows),
  });

  let aliasesUpserted = 0;
  for (let i = 0; i < aliasRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = aliasRows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await serviceClient.database
      .from("vibeusage_pricing_model_aliases")
      .upsert(batch, { onConflict: "usage_model,pricing_source,effective_from" });
    if (error) return json({ error: error.message }, 500);
    aliasesUpserted += batch.length;
  }

  let retention = null;
  if (retentionDays) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffDate = formatDateUTC(cutoff);
    const { error } = await serviceClient.database
      .from("vibeusage_pricing_profiles")
      .update({ active: false })
      .eq("source", pricingSource)
      .lt("effective_from", cutoffDate);
    if (error) return json({ error: error.message }, 500);

    const { error: aliasError } = await serviceClient.database
      .from("vibeusage_pricing_model_aliases")
      .update({ active: false })
      .eq("pricing_source", pricingSource)
      .lt("effective_from", cutoffDate);
    if (aliasError) return json({ error: aliasError.message }, 500);

    retention = { retention_days: retentionDays, cutoff_date: cutoffDate };
  }

  return json(
    {
      success: true,
      source: pricingSource,
      effective_from: effectiveFrom,
      models_total: models.length,
      models_processed: rows.length,
      models_skipped: skipped,
      rows_upserted: upserted,
      usage_models_total: usageModels.length,
      aliases_generated: aliasRows.length,
      aliases_upserted: aliasesUpserted,
      retention,
    },
    200,
  );
});

function getEnvValue(key) {
  try {
    if (typeof Deno !== "undefined" && Deno?.env?.get) {
      return Deno.env.get(key);
    }
  } catch (_) {
    // ignore
  }
  if (typeof process !== "undefined" && process?.env) {
    return process.env[key];
  }
  return null;
}

function normalizeAllowList(raw) {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((entry) => normalizeModel(entry))
    .filter((entry) => typeof entry === "string" && entry.length > 0);
  return list.length > 0 ? list : null;
}

function allowModel(modelId, allowList) {
  if (!allowList || allowList.length === 0) return true;
  for (const entry of allowList) {
    if (modelId === entry) return true;
    if (!entry.includes("/") && modelId.endsWith(`/${entry}`)) return true;
  }
  return false;
}

function normalizeCreated(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeContextLength(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function listUsageModels({ serviceClient, windowDays }) {
  const models = new Set();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const since = cutoff.toISOString();

  const { error } = await forEachPage({
    createQuery: () => {
      let query = serviceClient.database
        .from("vibeusage_tracker_hourly")
        .select("model")
        .gte("hour_start", since);
      query = applyCanaryFilter(query, { source: null, model: null });
      return query
        .order("hour_start", { ascending: true })
        .order("user_id", { ascending: true })
        .order("device_id", { ascending: true })
        .order("source", { ascending: true })
        .order("model", { ascending: true });
    },
    onPage: (rows) => {
      for (const row of rows || []) {
        const normalized = normalizeUsageModel(row?.model);
        if (normalized && normalized !== "unknown") models.add(normalized);
      }
    },
  });

  if (error) throw new Error(error.message || "Failed to list usage models");
  return Array.from(models.values());
}

async function listExistingAliases({
  serviceClient,
  usageModels,
  pricingSource,
  effectiveFrom,
}) {
  const normalizedUsageModels = Array.isArray(usageModels)
    ? usageModels.map((value) => normalizeUsageModel(value)).filter(Boolean)
    : [];
  if (!normalizedUsageModels.length) return [];

  const query = serviceClient?.database
    ?.from?.("vibeusage_pricing_model_aliases")
    ?.select?.("usage_model,pricing_model,pricing_source,effective_from,active");
  if (
    !query ||
    typeof query.eq !== "function" ||
    typeof query.in !== "function" ||
    typeof query.lte !== "function" ||
    typeof query.order !== "function" ||
    typeof query.limit !== "function"
  ) {
    return [];
  }

  const { data, error } = await query
    .eq("active", true)
    .eq("pricing_source", pricingSource)
    .in("usage_model", normalizedUsageModels)
    .lte("effective_from", effectiveFrom)
    .order("effective_from", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message || "Failed to list existing pricing aliases");
  return Array.isArray(data) ? data : [];
}

function buildAliasRows({
  usageModels,
  pricingModelIds,
  pricingMeta,
  pricingSource,
  effectiveFrom,
  existingAliasMap,
}) {
  const rows = [];
  for (const usageModel of usageModels) {
    if (matchesPricingModel(usageModel, pricingModelIds)) continue;

    const candidate = selectAliasCandidate({
      usageModel,
      pricingMeta,
      existingAliasMap,
    });
    if (!candidate) continue;

    rows.push({
      usage_model: usageModel,
      pricing_model: candidate.id,
      pricing_source: pricingSource,
      effective_from: effectiveFrom,
      active: true,
    });
  }
  return rows;
}

function matchesPricingModel(usageModel, pricingModelIds) {
  if (!usageModel) return false;
  if (pricingModelIds.has(usageModel)) return true;
  for (const id of pricingModelIds) {
    if (id.endsWith(`/${usageModel}`)) return true;
    if (usageModel.endsWith(`/${id}`)) return true;
  }
  return false;
}

function buildExistingAliasMap(aliasRows) {
  const map = new Map();
  for (const row of Array.isArray(aliasRows) ? aliasRows : []) {
    const usageModel = normalizeUsageModel(row?.usage_model);
    const pricingModel = normalizeModel(row?.pricing_model);
    const pricingSource = normalizeSource(row?.pricing_source);
    if (!usageModel || !pricingModel || !pricingSource) continue;
    const effectiveFrom = String(row?.effective_from || "");
    const existing = map.get(usageModel);
    if (!existing || effectiveFrom > existing.effective_from) {
      map.set(usageModel, {
        pricing_model: pricingModel,
        pricing_source: pricingSource,
        effective_from: effectiveFrom,
      });
    }
  }
  return map;
}

function selectAliasCandidate({ usageModel, pricingMeta, existingAliasMap }) {
  const usageRule = buildUsageAliasRule(usageModel);
  if (!usageRule) return null;

  const existing = existingAliasMap?.get?.(usageRule.usageModel) || null;
  const candidates = Array.isArray(pricingMeta)
    ? pricingMeta.filter((entry) => {
        const candidate = buildPricingAliasCandidate(entry?.id);
        if (!candidate) return false;
        return candidate.vendor === usageRule.vendor && candidate.aliasKey === usageRule.aliasKey;
      })
    : [];
  if (candidates.length !== 1) return null;

  const [candidate] = candidates;
  if (
    existing &&
    normalizeModel(existing.pricing_model) &&
    normalizeModel(existing.pricing_model) !== candidate.id
  ) {
    return null;
  }

  return candidate;
}

function buildUsageAliasRule(rawUsageModel) {
  const usageModel = normalizeUsageModel(rawUsageModel);
  if (!usageModel) return null;

  const vendor =
    detectVendorFromPrefix(usageModel) ||
    detectVendorFromFamily(usageModel);
  if (!vendor) return null;

  const aliasKey = buildAliasKeyForVendor(usageModel, vendor, { isUsageModel: true });
  if (!aliasKey) return null;

  return { usageModel, vendor, aliasKey };
}

function buildPricingAliasCandidate(rawModelId) {
  const id = normalizeModel(rawModelId);
  if (!id) return null;
  if (!isEligiblePricingModel(id)) return null;

  const vendor = detectVendorFromModelId(id);
  if (!vendor) return null;

  const aliasKey = buildAliasKeyForVendor(id, vendor, { isUsageModel: false });
  if (!aliasKey) return null;

  return { id, vendor, aliasKey };
}

function detectVendorFromModelId(modelId) {
  const normalized = String(modelId || "").trim().toLowerCase();
  const prefix = normalized.split("/")[0] || "";
  return normalizeVendor(prefix);
}

function detectVendorFromPrefix(usageModel) {
  const normalized = String(usageModel || "").trim().toLowerCase();
  const prefix = normalized.split("/")[0] || "";
  return normalizeVendor(prefix);
}

function detectVendorFromFamily(usageModel) {
  const normalized = String(usageModel || "").trim().toLowerCase();
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gpt")) return "openai";
  if (normalized.includes("minimax")) return "minimax";
  if (normalized.includes("gemini")) return "google";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("mimo")) return "xiaomi";
  if (normalized.includes("glm")) return "z-ai";
  if (normalized.includes("kimi") || normalized === "k2p5") return "moonshotai";
  return null;
}

function normalizeVendor(value) {
  switch (String(value || "").trim().toLowerCase()) {
    case "anthropic":
      return "anthropic";
    case "openai":
      return "openai";
    case "google":
      return "google";
    case "minimax":
      return "minimax";
    case "deepseek":
      return "deepseek";
    case "xiaomi":
      return "xiaomi";
    case "z-ai":
    case "zai":
    case "zai-org":
      return "z-ai";
    case "moonshotai":
      return "moonshotai";
    default:
      return null;
  }
}

function isEligiblePricingModel(modelId) {
  const normalized = String(modelId || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes(":free")) return false;
  if (normalized.includes(":exacto")) return false;
  if (normalized.includes(":extended")) return false;
  if (normalized.includes("-customtools")) return false;
  return true;
}

function buildAliasKeyForVendor(modelId, vendor, { isUsageModel } = {}) {
  switch (vendor) {
    case "anthropic":
      return extractAnthropicAliasKey(modelId);
    case "openai":
      return extractOpenAiAliasKey(modelId, { isUsageModel });
    case "minimax":
      return extractMiniMaxAliasKey(modelId);
    case "deepseek":
      return extractDeepSeekAliasKey(modelId);
    case "google":
      return extractGeminiAliasKey(modelId);
    case "z-ai":
      return extractGlmAliasKey(modelId);
    case "xiaomi":
      return extractMimoAliasKey(modelId);
    case "moonshotai":
      return extractKimiAliasKey(modelId, { isUsageModel });
    default:
      return null;
  }
}

function extractAnthropicAliasKey(modelId) {
  const normalized = normalizeAliasInput(modelId);
  const direct = normalized.match(/claude-(opus|sonnet|haiku)-(\d+)(?:[.-](\d+))?/);
  if (direct) return `claude-${direct[1]}-${formatVersion(direct[2], direct[3])}`;

  const reversed = normalized.match(/claude-(\d+(?:[.-]\d+)?)-(opus|sonnet|haiku)/);
  if (reversed) return `claude-${reversed[2]}-${normalizeVersionToken(reversed[1])}`;

  return null;
}

function extractOpenAiAliasKey(modelId, { isUsageModel } = {}) {
  const normalized = normalizeAliasInput(modelId);
  const match = normalized.match(/gpt-(\d+(?:[.-]\d+){0,2})(?:-(codex|mini|nano|pro|chat))?/);
  if (!match) return null;
  const version = normalizeVersionToken(match[1]);
  const suffix = match[2] || null;
  if (suffix) return `gpt-${version}-${suffix}`;
  if (isUsageModel && normalized.includes("-high")) return null;
  return `gpt-${version}`;
}

function extractMiniMaxAliasKey(modelId) {
  const normalized = normalizeAliasInput(modelId);
  const match = normalized.match(/minimax-(m\d+(?:[.-]\d+)?(?:-her)?)/);
  if (!match) return null;
  return `minimax-${normalizeVersionToken(match[1])}`;
}

function extractDeepSeekAliasKey(modelId) {
  const normalized = normalizeAliasInput(modelId);
  if (normalized === "deepseek-chat") return "deepseek-chat";

  const match = normalized.match(/deepseek-(?:(?:chat|reasoner)-)?((?:r|v)\d+(?:[.-]\d+)?)/);
  if (!match) return null;
  return `deepseek-${normalizeVersionToken(match[1])}`;
}

function extractGlmAliasKey(modelId) {
  const normalized = normalizeAliasInput(modelId);
  const match = normalized.match(/^glm-?(\d+(?:[.-]\d+)?)(v)?(?:-(flash|turbo))?$/);
  if (!match) return null;
  const version = normalizeVersionToken(match[1]);
  const vision = match[2] ? "v" : "";
  const suffix = match[3] || null;
  return suffix ? `glm-${version}${vision}-${suffix}` : `glm-${version}${vision}`;
}

function extractGeminiAliasKey(modelId) {
  const normalized = normalizeAliasInput(modelId);
  const match = normalized.match(
    /^gemini-(\d+(?:[.-]\d+)?)-(pro|flash|flash-lite)(?:-(image))?(?:-(preview(?:-[0-9-]+)?))?$/,
  );
  if (!match) return null;
  const version = normalizeVersionToken(match[1]);
  const tier = match[2];
  const image = match[3] ? "-image" : "";
  const preview = match[4] ? `-${match[4]}` : "";
  return `gemini-${version}-${tier}${image}${preview}`;
}

function extractMimoAliasKey(modelId) {
  const normalized = normalizeAliasInput(modelId);
  const match = normalized.match(/^mimo-(v\d+)-(flash|omni|pro)(?:-free)?$/);
  if (!match) return null;
  return `mimo-${normalizeVersionToken(match[1])}-${match[2]}`;
}

function extractKimiAliasKey(modelId, { isUsageModel } = {}) {
  const normalized = normalizeAliasInput(modelId);
  if (isUsageModel && normalized === "k2p5") return "kimi-k2.5";
  const match = normalized.match(/(?:kimi-)?k(\d+)(?:p(\d+)|[.-](\d+))?/);
  if (!match) return null;
  const minor = match[2] || match[3] || null;
  const version = minor ? `${match[1]}.${minor}` : match[1];
  return `kimi-k${version}`;
}

function normalizeAliasInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^.+\//, "")
    .replace(/[_\s]+/g, "-");
}

function formatVersion(major, minor) {
  return minor == null ? `${major}` : `${major}.${minor}`;
}

function normalizeVersionToken(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return normalized.replace(/(?<=\d)-(?=\d)/g, ".");
}

function toRateMicrosPerMillion(value) {
  const scaled = scaleDecimal(value, SCALE_MICROS_PER_MILLION);
  if (scaled == null) return null;
  if (scaled < 0n || scaled > MAX_RATE_MICROS_PER_MILLION) return null;
  return Number(scaled);
}

function scaleDecimal(value, scale) {
  if (value == null) return null;
  let str = typeof value === "string" ? value.trim() : String(value).trim();
  if (!str) return null;
  if (str.startsWith("-")) return null;
  if (str.includes("e") || str.includes("E")) {
    const n = Number(str);
    if (!Number.isFinite(n) || n < 0) return null;
    return BigInt(Math.round(n * Math.pow(10, scale)));
  }

  const parts = str.split(".");
  const whole = parts[0] || "0";
  const frac = parts[1] || "";
  if (!/^[0-9]+$/.test(whole) || (frac && !/^[0-9]+$/.test(frac))) return null;

  const digits = (whole.replace(/^0+(?=\d)/, "") || "0") + frac;
  const fracLen = frac.length;

  if (scale >= fracLen) {
    const zeros = "0".repeat(scale - fracLen);
    return BigInt(digits + zeros);
  }

  const cut = fracLen - scale;
  const keepLen = digits.length - cut;
  const kept = digits.slice(0, keepLen) || "0";
  const next = digits.slice(keepLen, keepLen + 1);
  let rounded = BigInt(kept);
  if (next && Number(next) >= 5) rounded += 1n;
  return rounded;
}

export const _private = {
  buildAliasRows,
  buildExistingAliasMap,
  buildPricingAliasCandidate,
  buildUsageAliasRule,
  detectVendorFromFamily,
  detectVendorFromPrefix,
  isEligiblePricingModel,
  matchesPricingModel,
};

export default handler;
