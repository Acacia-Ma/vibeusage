import { useCallback, useEffect, useMemo, useState } from "react";
import { getHeatmapRangeLocal } from "../lib/activity-heatmap";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import {
  buildDashboardCacheKey,
  clearDashboardCache,
  readDashboardCache,
  writeDashboardCache,
} from "../lib/dashboard-cache";
import { isMockEnabled } from "../lib/mock-data";
import { getTimeZoneCacheKey } from "../lib/timezone";
import { getUsageHeatmap } from "../lib/vibeusage-api";

export function useActivityHeatmap({
  baseUrl,
  accessToken,
  guestAllowed = false,
  weeks = 52,
  weekStartsOn = "sun",
  cacheKey,
  timeZone,
  tzOffsetMinutes,
  now,
}: any = {}) {
  const range = useMemo(() => {
    return getHeatmapRangeLocal({ weeks, weekStartsOn, now });
  }, [now, weeks, weekStartsOn]);
  const [daily, setDaily] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [source, setSource] = useState("edge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockEnabled = isMockEnabled();
  const tokenReady = isAccessTokenReady(accessToken);
  const cacheAllowed = !guestAllowed;

  const storageKey = useMemo(
    () =>
      buildDashboardCacheKey({
        scope: "heatmap",
        cacheKey,
        baseUrl,
        segments: [weeks, weekStartsOn, getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes })],
      }),
    [baseUrl, cacheKey, timeZone, tzOffsetMinutes, weeks, weekStartsOn],
  );

  const readCache = useCallback(() => {
    return readDashboardCache(storageKey, (parsed) => Boolean(parsed?.heatmap));
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
    try {
      const res = await getUsageHeatmap({
        baseUrl,
        accessToken: resolvedToken,
        weeks,
        to: range.to,
        weekStartsOn,
        timeZone,
        tzOffsetMinutes,
        signal,
      });
      if (signal?.aborted) return;
      const nowIso = new Date().toISOString();
      setHeatmap(res || null);
      setFetchedAt(nowIso);
      setSource("edge");
      if (cacheAllowed) {
        writeCache({
          heatmap: res || null,
          daily: [],
          fetchedAt: nowIso,
        });
      } else {
        clearCache();
      }
    } catch (e) {
      if (signal?.aborted || (e as any)?.name === "AbortError") return;
      if (cacheAllowed) {
        const cached = readCache();
        if (cached?.heatmap) {
          setHeatmap(cached.heatmap);
          setDaily(cached.daily || []);
          setFetchedAt(cached.fetchedAt || null);
          setSource("cache");
          setError(null);
        } else {
          setFetchedAt(null);
          const err = e as any;
          setError(err?.message || String(err));
          setSource("edge");
        }
      } else {
        setFetchedAt(null);
        const err = e as any;
        setError(err?.message || String(err));
        setSource("edge");
      }
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [
    accessToken,
    baseUrl,
    mockEnabled,
    guestAllowed,
    cacheAllowed,
    range.from,
    range.to,
    readCache,
    timeZone,
    tzOffsetMinutes,
    weekStartsOn,
    weeks,
    clearCache,
    writeCache,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setDaily([]);
      setLoading(false);
      setError(null);
      setHeatmap(null);
      setFetchedAt(null);
      setSource("edge");
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
  }, [
    accessToken,
    mockEnabled,
    refresh,
    tokenReady,
    guestAllowed,
    cacheAllowed,
    clearCache,
  ]);

  const normalizedSource = mockEnabled ? "mock" : source;

  return { range, daily, heatmap, source: normalizedSource, fetchedAt, loading, error, refresh };
}
