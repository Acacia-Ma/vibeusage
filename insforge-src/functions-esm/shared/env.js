function readEnvValue(key) {
  try {
    if (typeof Deno !== "undefined" && Deno?.env?.get) {
      const value = Deno.env.get(key);
      if (value != null) return value;
    }
  } catch (_error) {}
  try {
    if (typeof process !== "undefined" && process?.env) {
      const value = process.env[key];
      if (value != null) return value;
    }
  } catch (_error) {}
  return undefined;
}

export function getBaseUrl() {
  return readEnvValue("INSFORGE_INTERNAL_URL") || "http://insforge:7130";
}

export function getRequestBaseUrl(request) {
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

function getForwardedBaseUrl(request) {
  const headers = request?.headers;
  if (!headers || typeof headers.get !== "function") return null;
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(headers.get("host"));
  if (!host) return null;
  const proto = firstHeaderValue(headers.get("x-forwarded-proto")) || "https";
  return `${proto}://${host}`;
}

function firstHeaderValue(value) {
  if (typeof value !== "string") return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function getServiceRoleKey() {
  return (
    readEnvValue("INSFORGE_SERVICE_ROLE_KEY") ||
    readEnvValue("SERVICE_ROLE_KEY") ||
    readEnvValue("INSFORGE_API_KEY") ||
    readEnvValue("API_KEY") ||
    null
  );
}

export function getAnonKey() {
  return readEnvValue("ANON_KEY") || readEnvValue("INSFORGE_ANON_KEY") || null;
}

export function getJwtSecret() {
  return readEnvValue("INSFORGE_JWT_SECRET") || null;
}

export function getUsageMaxDays() {
  const raw = readEnvValue("VIBEUSAGE_USAGE_MAX_DAYS");
  if (raw == null || raw === "") return 800;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 800;
  return clampInt(n, 1, 5000);
}

export function getSlowQueryThresholdMs() {
  const raw = readEnvValue("VIBEUSAGE_SLOW_QUERY_MS");
  if (raw == null || raw === "") return 2000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2000;
  if (n <= 0) return 0;
  return clampInt(n, 1, 60000);
}

export function getPricingDefaults() {
  return {
    model: readEnvValue("VIBEUSAGE_PRICING_MODEL") || "gpt-5.2-codex",
    source: readEnvValue("VIBEUSAGE_PRICING_SOURCE") || "openrouter",
  };
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
