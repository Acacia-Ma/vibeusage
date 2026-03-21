const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 2;

type RepoMeta = {
  stars: number | null;
  avatarUrl: string | null;
};

type CacheEntry = {
  value: RepoMeta;
  expiresAt: number;
};

const EMPTY_META: RepoMeta = {
  stars: null,
  avatarUrl: null,
};

const metaCache = new Map<string, CacheEntry>();
const inFlightMetaRequests = new Map<string, Promise<RepoMeta>>();
const queuedMetaRequests: Array<() => void> = [];
let activeMetaRequests = 0;

export async function fetchGithubRepoMeta(
  repoId: string,
  { ttlMs = DEFAULT_CACHE_TTL_MS }: { ttlMs?: number } = {},
): Promise<RepoMeta> {
  const normalizedRepoId = normalizeRepoId(repoId);
  if (!normalizedRepoId) return EMPTY_META;
  if (typeof fetch !== "function") return EMPTY_META;

  const cached = readCachedMeta(normalizedRepoId);
  if (cached) return cached;

  const existing = inFlightMetaRequests.get(normalizedRepoId);
  if (existing) return existing;

  const pending = scheduleMetaRequest(async () => {
    try {
      const response = await fetch(`https://api.github.com/repos/${normalizedRepoId}`, {
        headers: { accept: "application/json" },
      });
      if (!response?.ok) {
        return cacheGithubRepoMeta(normalizedRepoId, EMPTY_META, FAILURE_CACHE_TTL_MS);
      }
      const data = await response.json();
      const meta: RepoMeta = {
        stars: normalizeStars(data?.stargazers_count),
        avatarUrl: typeof data?.owner?.avatar_url === "string" ? data.owner.avatar_url : null,
      };
      return cacheGithubRepoMeta(normalizedRepoId, meta, ttlMs);
    } catch (_error) {
      return cacheGithubRepoMeta(normalizedRepoId, EMPTY_META, FAILURE_CACHE_TTL_MS);
    }
  });

  inFlightMetaRequests.set(normalizedRepoId, pending);
  try {
    return await pending;
  } finally {
    if (inFlightMetaRequests.get(normalizedRepoId) === pending) {
      inFlightMetaRequests.delete(normalizedRepoId);
    }
  }
}

function normalizeRepoId(repoId: string) {
  if (typeof repoId !== "string") return "";
  return repoId.trim().replace(/^\/+|\/+$/g, "");
}

function normalizeStars(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function readCachedMeta(repoId: string) {
  const cached = metaCache.get(repoId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    metaCache.delete(repoId);
    return null;
  }
  return cached.value;
}

function cacheGithubRepoMeta(repoId: string, value: RepoMeta, ttlMs: number) {
  metaCache.set(repoId, {
    value,
    expiresAt: Date.now() + Math.max(1000, Math.floor(ttlMs)),
  });
  return value;
}

function scheduleMetaRequest<T>(task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeMetaRequests += 1;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          activeMetaRequests = Math.max(0, activeMetaRequests - 1);
          flushQueuedMetaRequests();
        });
    };
    queuedMetaRequests.push(run);
    flushQueuedMetaRequests();
  });
}

function flushQueuedMetaRequests() {
  while (activeMetaRequests < MAX_CONCURRENT_REQUESTS && queuedMetaRequests.length > 0) {
    const next = queuedMetaRequests.shift();
    next?.();
  }
}
