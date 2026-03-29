"use strict";

const CORE_KEY = "__vibeusagePublicSharingCore";
const PUBLIC_USER_TOKEN_RE =
  /^pv1-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function buildPublicShareToken(userId) {
  if (typeof userId !== "string") return "";
  const normalized = userId.trim().toLowerCase();
  if (!normalized) return "";
  return `pv1-${normalized}`;
}

function disabledState() {
  return {
    enabled: false,
    updated_at: null,
    share_token: null,
  };
}

function normalizeUpdatedAt(value) {
  return typeof value === "string" ? value : null;
}

function normalizeToken(value) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (!token) return null;
  if (token.length > 256) return null;
  return token;
}

function normalizeShareToken(value) {
  const token = normalizeToken(value);
  if (!token) return null;
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

async function resolvePublicView({
  baseUrl,
  shareToken,
  serviceRoleKey,
  anonKey,
  createServiceClient,
} = {}) {
  const token = normalizeShareToken(shareToken);
  if (!token) {
    return { ok: false, edgeClient: null, userId: null };
  }
  if (typeof serviceRoleKey !== "string" || serviceRoleKey.length === 0) {
    return { ok: false, edgeClient: null, userId: null };
  }
  if (typeof createServiceClient !== "function") {
    return { ok: false, edgeClient: null, userId: null };
  }

  const dbClient = await createServiceClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });
  const resolvedUserId = await resolvePublicUserId({ dbClient, token });
  if (!resolvedUserId) {
    return { ok: false, edgeClient: null, userId: null };
  }

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

async function getPublicVisibilityState({ edgeClient, userId }) {
  if (!edgeClient || typeof userId !== "string" || userId.trim().length === 0) {
    return disabledState();
  }

  try {
    const { data, error } = await edgeClient.database
      .from("vibeusage_public_views")
      .select("user_id,revoked_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return disabledState();

    const enabled = Boolean(data && !data.revoked_at);
    return {
      enabled,
      updated_at: normalizeUpdatedAt(data?.updated_at),
      share_token: enabled ? buildPublicShareToken(userId) : null,
    };
  } catch (_error) {
    return disabledState();
  }
}

async function setPublicVisibilityState({
  edgeClient,
  userId,
  enabled,
  nowIso,
  sha256Hex,
} = {}) {
  if (!edgeClient) throw new TypeError("edgeClient is required");
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new TypeError("userId is required");
  }
  if (typeof enabled !== "boolean") {
    throw new TypeError("enabled must be boolean");
  }
  if (typeof sha256Hex !== "function") {
    throw new TypeError("sha256Hex is required");
  }

  if (enabled) {
    await enablePublicVisibility({ edgeClient, userId, nowIso, sha256Hex });
  } else {
    await disablePublicVisibility({ edgeClient, userId, nowIso });
  }

  return getPublicVisibilityState({ edgeClient, userId });
}

async function enablePublicVisibility({ edgeClient, userId, nowIso, sha256Hex }) {
  const table = edgeClient.database.from("vibeusage_public_views");
  const shareToken = buildPublicShareToken(userId);
  const tokenHash = await sha256Hex(shareToken);
  const updatedAt = typeof nowIso === "string" && nowIso ? nowIso : new Date().toISOString();

  const nextRow = {
    user_id: userId,
    token_hash: tokenHash,
    revoked_at: null,
    updated_at: updatedAt,
  };

  if (typeof table.upsert === "function") {
    try {
      const { error: upsertErr } = await table.upsert([nextRow], { onConflict: "user_id" });
      if (!upsertErr) return;
    } catch (_error) {
      // fall through to legacy insert/update path
    }
  }

  const { data: existing, error: selectErr } = await table
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectErr) throw new Error(selectErr.message || "Failed to select public visibility row");

  if (existing?.user_id) {
    const { error: updateErr } = await table
      .update({ token_hash: tokenHash, revoked_at: null, updated_at: updatedAt })
      .eq("user_id", userId);
    if (updateErr) throw new Error(updateErr.message || "Failed to update public visibility row");
    return;
  }

  const { error: insertErr } = await table.insert([nextRow]);
  if (insertErr) throw new Error(insertErr.message || "Failed to insert public visibility row");
}

async function disablePublicVisibility({ edgeClient, userId, nowIso }) {
  const updatedAt = typeof nowIso === "string" && nowIso ? nowIso : new Date().toISOString();

  const { error } = await edgeClient.database
    .from("vibeusage_public_views")
    .update({ revoked_at: updatedAt, updated_at: updatedAt })
    .eq("user_id", userId);

  if (error) throw new Error(error.message || "Failed to revoke public visibility row");
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      buildPublicShareToken,
      isPublicShareToken,
      resolvePublicView,
      getPublicVisibilityState,
      setPublicVisibilityState,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
