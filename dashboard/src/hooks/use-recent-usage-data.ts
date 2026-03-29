import { useCallback, useEffect, useMemo, useState } from "react";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import {
  buildDashboardCacheKey,
  clearDashboardCache,
  readDashboardCache,
  writeDashboardCache,
} from "../lib/dashboard-cache";
import { isMockEnabled } from "../lib/mock-data";
import { getLocalDayKey, getTimeZoneCacheKey } from "../lib/timezone";
import { getUsageSummary } from "../lib/vibeusage-api";

export function useRecentUsageData({
  baseUrl,
  accessToken,
  guestAllowed = false,
  cacheKey,
  timeZone,
  tzOffsetMinutes,
  now,
}: any = {}) {
  const [rolling, setRolling] = useState<any | null>(null);
  const [source, setSource] = useState<string>("edge");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockEnabled = isMockEnabled();
  const tokenReady = isAccessTokenReady(accessToken);
  const cacheAllowed = !guestAllowed;
  const anchorDay = useMemo(
    () =>
      getLocalDayKey({
        timeZone,
        offsetMinutes: tzOffsetMinutes,
        date: now || new Date(),
      }),
    [now, timeZone, tzOffsetMinutes],
  );

  const storageKey = buildDashboardCacheKey({
    scope: "recentUsage",
    cacheKey,
    baseUrl,
    segments: [anchorDay, getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes })],
  });

  const readCache = useCallback(() => {
    return readDashboardCache(storageKey, (parsed) => Boolean(parsed?.rolling));
  }, [storageKey]);

  const writeCache = useCallback(
    (payload: any) => {
      writeDashboardCache(storageKey, payload, { source: "edge" });
    },
    [storageKey],
  );

  const clearCache = useCallback(() => {
    clearDashboardCache(storageKey);
  }, [storageKey]);

  const refresh = useCallback(async ({ signal }: any = {}) => {
    const resolvedToken = await resolveAuthAccessToken(accessToken);
    if (!resolvedToken && !mockEnabled) return;
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    setSource("edge");
    try {
      const response = await getUsageSummary({
        baseUrl,
        accessToken: resolvedToken,
        from: anchorDay,
        to: anchorDay,
        timeZone,
        tzOffsetMinutes,
        signal,
        rolling: true,
      });
      if (signal?.aborted) return;
      const nextRolling = response?.rolling || null;
      const nowIso = new Date().toISOString();
      setRolling(nextRolling);
      setFetchedAt(nowIso);
      setSource("edge");

      if (nextRolling && cacheAllowed) {
        writeCache({ rolling: nextRolling, fetchedAt: nowIso });
      } else if (!cacheAllowed) {
        clearCache();
      }
    } catch (e) {
      if (signal?.aborted || (e as any)?.name === "AbortError") return;
      if (cacheAllowed) {
        const cached = readCache();
        if (cached?.rolling) {
          setRolling(cached.rolling);
          setFetchedAt(cached.fetchedAt || null);
          setSource("cache");
          setError(null);
        } else {
          const err = e as any;
          setError(err?.message || String(err));
          setSource("edge");
          setFetchedAt(null);
        }
      } else {
        const err = e as any;
        setError(err?.message || String(err));
        setSource("edge");
        setFetchedAt(null);
      }
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [
    accessToken,
    anchorDay,
    baseUrl,
    cacheAllowed,
    clearCache,
    mockEnabled,
    readCache,
    timeZone,
    tzOffsetMinutes,
    writeCache,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setRolling(null);
      setError(null);
      setLoading(false);
      setSource("edge");
      setFetchedAt(null);
      return;
    }
    setLoading(true);
    if (!cacheAllowed) clearCache();
    setError(null);
    setSource("edge");
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [cacheAllowed, clearCache, guestAllowed, mockEnabled, refresh, tokenReady]);

  const normalizedSource = mockEnabled ? "mock" : source;

  return {
    rolling,
    source: normalizedSource,
    fetchedAt,
    loading,
    error,
    refresh,
  };
}
