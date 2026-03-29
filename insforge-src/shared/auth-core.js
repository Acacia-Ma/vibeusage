"use strict";

const CORE_KEY = "__vibeusageAuthCore";

function getBearerToken(headerValue) {
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
    if (typeof atob === "function") return atob(normalized);
  } catch (_error) {
    // fall through
  }
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("utf8");
    }
  } catch (_error) {
    // ignore
  }
  return null;
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

function isProjectAdminBearer(token) {
  return getJwtRole(token) === "project_admin";
}

function isJwtExpired(payload) {
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return false;
  return exp * 1000 <= Date.now();
}

function base64UrlEncode(value) {
  let base64 = null;
  try {
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(value).toString("base64");
    }
  } catch (_error) {
    // ignore
  }
  if (!base64 && typeof btoa === "function" && value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    base64 = btoa(binary);
  }
  if (!base64) return null;
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function verifyUserJwtHs256({ token, jwtSecret }) {
  const secret = typeof jwtSecret === "string" && jwtSecret.length > 0 ? jwtSecret : null;
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

async function getEdgeClientAndUserIdFast({
  baseUrl,
  bearer,
  createUserEdgeClient,
  jwtSecret,
} = {}) {
  const edgeClient =
    typeof createUserEdgeClient === "function"
      ? await createUserEdgeClient({ baseUrl, bearer })
      : null;
  const local = await verifyUserJwtHs256({ token: bearer, jwtSecret });
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

async function getEdgeClientAndUserId({
  baseUrl,
  bearer,
  createUserEdgeClient,
  jwtSecret,
} = {}) {
  const auth = await getEdgeClientAndUserIdFast({
    baseUrl,
    bearer,
    createUserEdgeClient,
    jwtSecret,
  });
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

async function getAccessContext({
  baseUrl,
  bearer,
  allowPublic = false,
  createUserEdgeClient,
  jwtSecret,
  isPublicShareToken,
  resolvePublicView,
} = {}) {
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

  const auth = await getEdgeClientAndUserIdFast({
    baseUrl,
    bearer,
    createUserEdgeClient,
    jwtSecret,
  });
  if (auth.ok) {
    return { ok: true, edgeClient: auth.edgeClient, userId: auth.userId, accessType: "user" };
  }
  if (!allowPublic) {
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

  if (typeof isPublicShareToken !== "function" || !isPublicShareToken(bearer)) {
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

  const publicView =
    typeof resolvePublicView === "function"
      ? await resolvePublicView({ baseUrl, shareToken: bearer })
      : null;
  if (!publicView?.ok) {
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

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      getBearerToken,
      isProjectAdminBearer,
      verifyUserJwtHs256,
      getEdgeClientAndUserIdFast,
      getEdgeClientAndUserId,
      getAccessContext,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
