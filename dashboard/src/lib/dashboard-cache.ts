type AnyRecord = Record<string, any>;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function normalizeSegment(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function resolveDashboardCacheHost(baseUrl: any) {
  try {
    const url = new URL(String(baseUrl || ""));
    return url.host || "default";
  } catch (_error) {
    return "default";
  }
}

export function buildDashboardCacheKey({
  scope,
  cacheKey,
  baseUrl,
  segments = [],
}: AnyRecord = {}) {
  const normalizedScope = normalizeSegment(scope);
  const normalizedCacheKey = normalizeSegment(cacheKey);
  if (!normalizedScope || !normalizedCacheKey) return null;

  const parts = ["vibeusage", normalizedScope, normalizedCacheKey, resolveDashboardCacheHost(baseUrl)];
  for (const segment of Array.isArray(segments) ? segments : []) {
    const normalized = normalizeSegment(segment);
    if (normalized) parts.push(normalized);
  }
  return parts.join(".");
}

export function readDashboardCache(storageKey: string | null, validate?: (value: any) => boolean) {
  const storage = getStorage();
  if (!storage || !storageKey) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof validate === "function" && !validate(parsed)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function writeDashboardCache(
  storageKey: string | null,
  payload: AnyRecord,
  { source }: AnyRecord = {},
) {
  const storage = getStorage();
  if (!storage || !storageKey) return;
  const cachedAt = new Date().toISOString();
  const nextPayload = {
    ...payload,
    fetchedAt: typeof payload?.fetchedAt === "string" ? payload.fetchedAt : cachedAt,
    provenance: {
      kind: "cache",
      source: typeof source === "string" && source ? source : "edge",
      cachedAt,
    },
  };
  try {
    storage.setItem(storageKey, JSON.stringify(nextPayload));
  } catch (_error) {
    // ignore write errors
  }
}

export function clearDashboardCache(storageKey: string | null) {
  const storage = getStorage();
  if (!storage || !storageKey) return;
  try {
    storage.removeItem(storageKey);
  } catch (_error) {
    // ignore remove errors
  }
}
