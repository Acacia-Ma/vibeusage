"use strict";

const CORE_KEY = "__vibeusageLeaderboardCore";
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");
const userIdentityCore = globalThis.__vibeusageUserIdentityCore;
if (!userIdentityCore) throw new Error("user identity core not initialized");

const { addUtcDays, formatDateUTC, toUtcDay } = dateCore;
const { sanitizeAvatarUrl } = userIdentityCore;

function normalizeLeaderboardPeriod(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "week" || value === "month" || value === "total") return value;
  return null;
}

function computeLeaderboardWindow({ period }) {
  const normalized = normalizeLeaderboardPeriod(period);
  if (normalized === "week") {
    const today = toUtcDay(new Date());
    const dow = today.getUTCDay();
    const from = addUtcDays(today, -dow);
    const to = addUtcDays(from, 6);
    return { from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (normalized === "month") {
    const today = toUtcDay(new Date());
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (normalized === "total") {
    return { from: "1970-01-01", to: "9999-12-31" };
  }

  throw new Error(`Unsupported period: ${String(period)}`);
}

function resolveLeaderboardOtherTokens({ row, totalTokens, gptTokens, claudeTokens }) {
  const explicit = row?.other_tokens;
  if (explicit != null) return BigInt(explicit);

  const derived = totalTokens - gptTokens - claudeTokens;
  return derived > 0n ? derived : 0n;
}

function normalizeLeaderboardDisplayName(value) {
  if (typeof value !== "string") return "Anonymous";
  const trimmed = value.trim();
  return trimmed || "Anonymous";
}

function normalizeLeaderboardAvatarUrl(value) {
  return sanitizeAvatarUrl(value);
}

function normalizeLeaderboardGeneratedAt(value) {
  if (typeof value !== "string") return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      normalizeLeaderboardPeriod,
      computeLeaderboardWindow,
      resolveLeaderboardOtherTokens,
      normalizeLeaderboardDisplayName,
      normalizeLeaderboardAvatarUrl,
      normalizeLeaderboardGeneratedAt,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
