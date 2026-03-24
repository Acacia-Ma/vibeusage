import { getAnonKey, getJwtSecret, getServiceRoleKey } from "./env.js";
import { createEdgeClient } from "./insforge-client.js";

const PUBLIC_USER_TOKEN_RE = /^pv1-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function getBearerToken(headerValue) {
  if (!headerValue) return null;
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) return null;
  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function decodeBase64Url(value) {
  if (typeof value !== "string") return null;
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (pad) normalized += "=".repeat(4 - pad);
  try {
    return atob(normalized);
  } catch (_error) {
    return null;
  }
}

function decodeJwtSection(token, index) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < index + 1) return null;
  const raw = decodeBase64Url(parts[index]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function decodeJwtPayload(token) {
  return decodeJwtSection(token, 1);
}

function decodeJwtHeader(token) {
  return decodeJwtSection(token, 0);
}

function getJwtRole(token) {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  if (typeof role === "string" && role.length > 0) return role;
  const appRole = payload?.app_metadata?.role;
  if (typeof appRole === "string" && appRole.length > 0) return appRole;
  const roles = payload?.app_metadata?.roles;
  if (Array.isArray(roles)) {
    if (roles.includes("project_admin")) return "project_admin";
    const match = roles.find((value) => typeof value === "string" && value.length > 0);
    if (match) return match;
  }
  return null;
}

export function isProjectAdminBearer(token) {
  return getJwtRole(token) === "project_admin";
}

function isJwtExpired(payload) {
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return false;
  return exp * 1000 <= Date.now();
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function verifyUserJwtHs256({ token }) {
  const secret = getJwtSecret();
  if (!secret) {
    return { ok: false, userId: null, error: "Missing jwt secret", code: "missing_jwt_secret" };
  }
  if (typeof token !== "string") return { ok: false, userId: null, error: "Invalid token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, userId: null, error: "Invalid token" };
  const header = decodeJwtHeader(token);
  if (!header || header.alg !== "HS256") {
    return { ok: false, userId: null, error: "Unsupported alg" };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) return { ok: false, userId: null, error: "Invalid payload" };
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return { ok: false, userId: null, error: "Missing exp" };
  if (isJwtExpired(payload)) return { ok: false, userId: null, error: "Token expired" };
  const cryptoSubtle = globalThis.crypto?.subtle;
  if (!cryptoSubtle) return { ok: false, userId: null, error: "Crypto unavailable" };
  const data = `${parts[0]}.${parts[1]}`;
  const encoder = new TextEncoder();
  const key = await cryptoSubtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await cryptoSubtle.sign("HMAC", key, encoder.encode(data));
  const expected = base64UrlEncode(signature);
  if (!expected || expected !== parts[2]) {
    return { ok: false, userId: null, error: "Invalid signature" };
  }
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return { ok: false, userId: null, error: "Missing sub" };
  return { ok: true, userId, error: null };
}

async function createUserEdgeClient({ baseUrl, bearer }) {
  return createEdgeClient({
    baseUrl,
    anonKey: getAnonKey() || undefined,
    edgeFunctionToken: bearer,
  });
}

export async function resolvePublicView({ baseUrl, shareToken }) {
  const token = normalizeShareToken(shareToken);
  if (!token) return { ok: false, edgeClient: null, userId: null };
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return { ok: false, edgeClient: null, userId: null };
  const anonKey = getAnonKey();
  const dbClient = await createEdgeClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });
  const resolvedUserId = await resolvePublicUserId({ dbClient, token });
  if (!resolvedUserId) return { ok: false, edgeClient: null, userId: null };
  const { data: settings, error: settingsErr } = await dbClient.database
    .from("vibeusage_user_settings")
    .select("leaderboard_public")
    .eq("user_id", resolvedUserId)
    .maybeSingle();
  if (settingsErr || settings?.leaderboard_public !== true) {
    return { ok: false, edgeClient: null, userId: null };
  }
  return { ok: true, edgeClient: dbClient, userId: resolvedUserId };
}

async function resolvePublicUserId({ dbClient, token }) {
  if (!dbClient || !token) return null;
  const { data, error } = await dbClient.database
    .from("vibeusage_public_views")
    .select("user_id")
    .eq("user_id", token.userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data?.user_id) return null;
  return data.user_id;
}

function normalizeShareToken(value) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (!token || token.length > 256) return null;
  const normalized = token.toLowerCase();
  if (token !== normalized) return null;
  const publicUserMatch = normalized.match(PUBLIC_USER_TOKEN_RE);
  if (publicUserMatch?.[1]) {
    return { kind: "user", userId: publicUserMatch[1] };
  }
  return null;
}

function isPublicShareToken(value) {
  return Boolean(normalizeShareToken(value));
}

export async function getEdgeClientAndUserIdFast({ baseUrl, bearer }) {
  const edgeClient = await createUserEdgeClient({ baseUrl, bearer });
  const local = await verifyUserJwtHs256({ token: bearer });
  if (local.ok) {
    return { ok: true, edgeClient, userId: local.userId };
  }
  if (local?.code !== "missing_jwt_secret") {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      status: 401,
      error: "Unauthorized",
      code: local?.code || "invalid_jwt",
    };
  }
  const claimed = getClaimedJwtUser({ token: bearer });
  if (!claimed.ok) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      status: 401,
      error: "Unauthorized",
      code: claimed.code || "invalid_jwt",
    };
  }
  return { ok: true, edgeClient, userId: claimed.userId };
}

export async function getEdgeClientAndUserId({ baseUrl, bearer }) {
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (!auth.ok) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      status: auth.status ?? 401,
      error: auth.error ?? "Unauthorized",
      code: auth.code ?? null,
    };
  }
  return { ok: true, edgeClient: auth.edgeClient, userId: auth.userId };
}

export async function getAccessContext({ baseUrl, bearer, allowPublic = false }) {
  if (!bearer) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: 401,
      error: "Unauthorized",
      code: "missing_bearer",
    };
  }
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (auth.ok) {
    return { ok: true, edgeClient: auth.edgeClient, userId: auth.userId, accessType: "user" };
  }
  if (!allowPublic || !isPublicShareToken(bearer)) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: auth.status ?? 401,
      error: auth.error ?? "Unauthorized",
      code: auth.code ?? null,
    };
  }
  const publicView = await resolvePublicView({ baseUrl, shareToken: bearer });
  if (!publicView.ok) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: 401,
      error: "Unauthorized",
    };
  }
  return {
    ok: true,
    edgeClient: publicView.edgeClient,
    userId: publicView.userId,
    accessType: "public",
  };
}

function getClaimedJwtUser({ token }) {
  const header = decodeJwtHeader(token);
  if (!header || header.alg !== "HS256") {
    return { ok: false, userId: null, code: "invalid_jwt" };
  }
  const payload = decodeJwtPayload(token);
  if (!payload || isJwtExpired(payload)) {
    return { ok: false, userId: null, code: "invalid_jwt" };
  }
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return { ok: false, userId: null, code: "invalid_jwt" };
  return { ok: true, userId, code: null };
}
