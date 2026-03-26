"use strict";

const CORE_KEY = "__vibeusageUserIdentityCore";

function resolveUserIdentity(row) {
  return {
    displayName: resolveUserDisplayName(row),
    avatarUrl: resolveUserAvatarUrl(row),
  };
}

function resolveUserDisplayName(row) {
  const profile = isObject(row?.profile) ? row.profile : null;
  const metadata = isObject(row?.metadata) ? row.metadata : null;

  return (
    sanitizeDisplayName(row?.nickname) ||
    sanitizeDisplayName(profile?.name) ||
    sanitizeDisplayName(profile?.full_name) ||
    sanitizeDisplayName(metadata?.full_name) ||
    sanitizeDisplayName(metadata?.name) ||
    null
  );
}

function resolveUserAvatarUrl(row) {
  const profile = isObject(row?.profile) ? row.profile : null;
  const metadata = isObject(row?.metadata) ? row.metadata : null;

  return (
    sanitizeAvatarUrl(row?.avatar_url) ||
    sanitizeAvatarUrl(profile?.avatar_url) ||
    sanitizeAvatarUrl(metadata?.avatar_url) ||
    sanitizeAvatarUrl(metadata?.picture) ||
    null
  );
}

function sanitizeDisplayName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;
  if (trimmed.length > 128) return trimmed.slice(0, 128);
  return trimmed;
}

function sanitizeAvatarUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 1024) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function isObject(value) {
  return Boolean(value && typeof value === "object");
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      resolveUserIdentity,
      resolveUserDisplayName,
      resolveUserAvatarUrl,
      sanitizeDisplayName,
      sanitizeAvatarUrl,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
