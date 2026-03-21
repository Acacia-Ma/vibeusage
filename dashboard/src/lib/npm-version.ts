import { safeGetItem, safeRemoveItem, safeSetItem } from "./safe-browser";

const VERSION_CACHE_KEY = "vibeusage.latest_tracker_version";
const VERSION_CACHE_AT_KEY = "vibeusage.latest_tracker_version_at";
const VERSION_FAILURE_AT_KEY = "vibeusage.latest_tracker_version_failure_at";
const VERSION_TTL_MS = 6 * 60 * 60 * 1000;
const VERSION_FAILURE_TTL_MS = 60 * 1000;
const REGISTRY_URL = "https://registry.npmjs.org/vibeusage/latest";

let versionRequestInFlight: Promise<string | null> | null = null;

function isValidVersion(value: any) {
  return typeof value === "string" && /^\d+\.\d+\.\d+/.test(value);
}

function readCachedVersion(nowMs: number) {
  const cached = safeGetItem(VERSION_CACHE_KEY);
  if (!isValidVersion(cached)) return null;
  const cachedAtRaw = safeGetItem(VERSION_CACHE_AT_KEY);
  const cachedAt = Number(cachedAtRaw);
  if (!Number.isFinite(cachedAt)) return null;
  if (nowMs - cachedAt > VERSION_TTL_MS) return null;
  return cached;
}

function readStaleVersion() {
  const cached = safeGetItem(VERSION_CACHE_KEY);
  return isValidVersion(cached) ? cached : null;
}

function writeCachedVersion(version: any, nowMs: number) {
  safeSetItem(VERSION_CACHE_KEY, version);
  safeSetItem(VERSION_CACHE_AT_KEY, String(nowMs));
  safeRemoveItem(VERSION_FAILURE_AT_KEY);
}

function hasFreshFailure(nowMs: number) {
  const failedAtRaw = safeGetItem(VERSION_FAILURE_AT_KEY);
  const failedAt = Number(failedAtRaw);
  if (!Number.isFinite(failedAt)) return false;
  return nowMs - failedAt <= VERSION_FAILURE_TTL_MS;
}

function markFailedVersionFetch(nowMs: number) {
  safeSetItem(VERSION_FAILURE_AT_KEY, String(nowMs));
}

export async function fetchLatestTrackerVersion({ allowStale = true } = {}) {
  const nowMs = Date.now();
  const cached = readCachedVersion(nowMs);
  if (cached) return cached;
  if (hasFreshFailure(nowMs)) {
    return allowStale ? readStaleVersion() : null;
  }

  if (typeof fetch !== "function") {
    return allowStale ? readStaleVersion() : null;
  }

  if (versionRequestInFlight) {
    return versionRequestInFlight;
  }

  versionRequestInFlight = (async () => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    const scheduleTimeout =
      typeof window !== "undefined" && window.setTimeout ? window.setTimeout : setTimeout;
    const clearTimeoutFn =
      typeof window !== "undefined" && window.clearTimeout ? window.clearTimeout : clearTimeout;
    if (typeof AbortController !== "undefined") {
      const localController = new AbortController();
      controller = localController;
      timeoutId = scheduleTimeout(() => localController.abort(), 2500);
    }

    try {
      const response = await fetch(REGISTRY_URL, {
        headers: { accept: "application/json" },
        signal: controller?.signal,
      });
      if (!response.ok) {
        markFailedVersionFetch(nowMs);
        return allowStale ? readStaleVersion() : null;
      }
      const data = await response.json();
      const version = typeof data?.version === "string" ? data.version : "";
      if (!isValidVersion(version)) {
        markFailedVersionFetch(nowMs);
        return allowStale ? readStaleVersion() : null;
      }
      writeCachedVersion(version, nowMs);
      return version;
    } catch (_e) {
      markFailedVersionFetch(nowMs);
      return allowStale ? readStaleVersion() : null;
    } finally {
      if (timeoutId) clearTimeoutFn(timeoutId);
      versionRequestInFlight = null;
    }
  })();

  return versionRequestInFlight;
}
