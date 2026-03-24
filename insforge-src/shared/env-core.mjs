"use strict";

const CORE_KEY = "__vibeusageEnvCore";
const DEFAULT_BASE_URL = "http://insforge:7130";
const DEFAULT_USAGE_MAX_DAYS = 800;
const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 2000;
const DEFAULT_PRICING_MODEL = "gpt-5.2-codex";
const DEFAULT_PRICING_SOURCE = "openrouter";

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

function readDenoEnvValue(key) {
  try {
    if (typeof Deno !== "undefined" && Deno?.env?.get) {
      const value = Deno.env.get(key);
      return value == null ? null : value;
    }
  } catch (_error) {}
  return null;
}

function readEnvValue(key) {
  const denoValue = readDenoEnvValue(key);
  if (denoValue != null) return denoValue;
  try {
    if (typeof process !== "undefined" && process?.env) {
      const value = process.env[key];
      if (value != null) return value;
    }
  } catch (_error) {}
  return null;
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function getBaseUrl() {
  return readDenoEnvValue("INSFORGE_INTERNAL_URL") || DEFAULT_BASE_URL;
}

function firstHeaderValue(value) {
  if (typeof value !== "string") return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function getForwardedBaseUrl(request) {
  const headers = request?.headers;
  if (!headers || typeof headers.get !== "function") return null;
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(headers.get("host"));
  if (!host) return null;
  const proto = firstHeaderValue(headers.get("x-forwarded-proto")) || "https";
  return `${proto}://${host}`;
}

function getRequestBaseUrl(request) {
  const forwarded = getForwardedBaseUrl(request);
  if (forwarded) return forwarded;
  if (request && typeof request.url === "string") {
    try {
      const url = new URL(request.url);
      if (url.origin && url.origin !== "null") return url.origin;
    } catch (_error) {}
  }
  return getBaseUrl();
}

function getServiceRoleKey() {
  return (
    readDenoEnvValue("INSFORGE_SERVICE_ROLE_KEY") ||
    readDenoEnvValue("SERVICE_ROLE_KEY") ||
    readDenoEnvValue("INSFORGE_API_KEY") ||
    readDenoEnvValue("API_KEY") ||
    null
  );
}

function getAnonKey() {
  return readDenoEnvValue("ANON_KEY") || readDenoEnvValue("INSFORGE_ANON_KEY") || null;
}

function getJwtSecret() {
  return readDenoEnvValue("INSFORGE_JWT_SECRET") || null;
}

function getUsageMaxDays() {
  const raw = readEnvValue("VIBEUSAGE_USAGE_MAX_DAYS");
  if (raw == null || raw === "") return DEFAULT_USAGE_MAX_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_USAGE_MAX_DAYS;
  return clampInt(n, 1, 5000);
}

function getSlowQueryThresholdMs() {
  const raw = readEnvValue("VIBEUSAGE_SLOW_QUERY_MS");
  if (raw == null || raw === "") return DEFAULT_SLOW_QUERY_THRESHOLD_MS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SLOW_QUERY_THRESHOLD_MS;
  if (n <= 0) return 0;
  return clampInt(n, 1, 60000);
}

function normalizePricingModel(value) {
  const normalized = usageModelCore.normalizeModel?.(value) || null;
  if (!normalized || normalized.toLowerCase() === "unknown") return null;
  return normalized;
}

function getPricingDefaults() {
  const primaryModel = normalizePricingModel(readEnvValue("VIBEUSAGE_PRICING_MODEL"));
  const primarySource = runtimePrimitivesCore.normalizeSource(
    readEnvValue("VIBEUSAGE_PRICING_SOURCE"),
  );
  return {
    model: primaryModel || DEFAULT_PRICING_MODEL,
    source: primarySource || DEFAULT_PRICING_SOURCE,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      readEnvValue,
      clampInt,
      getBaseUrl,
      getRequestBaseUrl,
      getServiceRoleKey,
      getAnonKey,
      getJwtSecret,
      getUsageMaxDays,
      getSlowQueryThresholdMs,
      getPricingDefaults,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
