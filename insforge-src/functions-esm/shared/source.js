const MAX_SOURCE_LENGTH = 64;

export function normalizeSource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length > MAX_SOURCE_LENGTH) return normalized.slice(0, MAX_SOURCE_LENGTH);
  return normalized;
}

export function getSourceParam(url) {
  if (!url || typeof url.searchParams?.get !== "function") {
    return { ok: false, error: "Invalid request URL" };
  }
  const raw = url.searchParams.get("source");
  if (raw == null || raw.trim() === "") return { ok: true, source: null };
  const normalized = normalizeSource(raw);
  if (!normalized) return { ok: false, error: "Invalid source" };
  return { ok: true, source: normalized };
}
