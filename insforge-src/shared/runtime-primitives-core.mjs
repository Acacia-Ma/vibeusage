"use strict";

const CORE_KEY = "__vibeusageRuntimePrimitivesCore";
const MAX_SOURCE_LENGTH = 64;

function toBigInt(value) {
  if (typeof value === "bigint") return value >= 0n ? value : 0n;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return BigInt(Math.floor(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return 0n;
    try {
      return BigInt(trimmed);
    } catch (_error) {
      return 0n;
    }
  }
  return 0n;
}

function toPositiveIntOrNull(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return null;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof value === "bigint") {
    if (value <= 0n) return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function toPositiveInt(value) {
  const n = toPositiveIntOrNull(value);
  return n == null ? 0 : n;
}

function normalizeSource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length > MAX_SOURCE_LENGTH) return normalized.slice(0, MAX_SOURCE_LENGTH);
  return normalized;
}

function getSourceParam(url) {
  if (!url || typeof url.searchParams?.get !== "function") {
    return { ok: false, error: "Invalid request URL" };
  }
  const raw = url.searchParams.get("source");
  if (raw == null) return { ok: true, source: null };
  if (raw.trim() === "") return { ok: true, source: null };
  const normalized = normalizeSource(raw);
  if (!normalized) return { ok: false, error: "Invalid source" };
  return { ok: true, source: normalized };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      MAX_SOURCE_LENGTH,
      toBigInt,
      toPositiveInt,
      toPositiveIntOrNull,
      normalizeSource,
      getSourceParam,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
