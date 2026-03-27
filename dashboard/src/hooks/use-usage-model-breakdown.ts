import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import {
  buildDashboardCacheKey,
  clearDashboardCache,
  readDashboardCache,
  writeDashboardCache,
} from "../lib/dashboard-cache";
import {
  readDashboardLiveSnapshot,
  writeDashboardLiveSnapshot,
} from "../lib/dashboard-live-snapshot";
import { isMockEnabled } from "../lib/mock-data";
import { getTimeZoneCacheKey } from "../lib/timezone";
import { getUsageModelBreakdown } from "../lib/vibeusage-api";

export function useUsageModelBreakdown({
  baseUrl,
  accessToken,
  guestAllowed = false,
  from,
  to,
  cacheKey,
  timeZone,
  tzOffsetMinutes,
}: any = {}) {
  const [breakdown, setBreakdown] = useState<any | null>(null);
  const [source, setSource] = useState<string>("edge");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedStorageKey, setResolvedStorageKey] = useState<string | null>(null);
  const mockEnabled = isMockEnabled();
  const tokenReady = isAccessTokenReady(accessToken);
  const cacheAllowed = !guestAllowed;

  const storageKey = useMemo(
    () =>
      buildDashboardCacheKey({
        scope: "modelBreakdown",
        cacheKey,
        baseUrl,
        segments: [from, to, getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes })],
      }),
    [baseUrl, cacheKey, from, timeZone, to, tzOffsetMinutes],
  );
  const liveSnapshot = storageKey ? readDashboardLiveSnapshot("modelBreakdown", storageKey) : null;

  const readCache = useCallback(() => {
    return readDashboardCache(storageKey, (parsed) => Boolean(parsed?.breakdown));
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

  const visibleStateRef = useRef(false);
  useEffect(() => {
    visibleStateRef.current = Boolean(breakdown);
  }, [breakdown]);

  const applySnapshot = useCallback((snapshot: any) => {
    if (!snapshot) return;
    setBreakdown(snapshot.breakdown || null);
    setSource("edge");
    setResolvedStorageKey(storageKey);
  }, [storageKey]);

  const hasImmediateSnapshot =
    resolvedStorageKey !== storageKey && Boolean(storageKey) && Boolean(liveSnapshot?.breakdown);
  const visibleBreakdown = hasImmediateSnapshot ? liveSnapshot?.breakdown || null : breakdown;
  const visibleSource = hasImmediateSnapshot ? "edge" : source;
  const visibleLoading = hasImmediateSnapshot ? false : loading;
  const visibleRefreshing = hasImmediateSnapshot ? true : refreshing;
  const visibleError = hasImmediateSnapshot ? null : error;

  const refresh = useCallback(async ({ signal }: any = {}) => {
    const snapshot = readDashboardLiveSnapshot("modelBreakdown", storageKey);
    if (snapshot?.breakdown) {
      applySnapshot(snapshot);
    }
    const hasVisibleState = Boolean(snapshot?.breakdown) || visibleStateRef.current;
    setLoading(!hasVisibleState);
    setRefreshing(hasVisibleState);
    setError(null);
    const resolvedToken = await resolveAuthAccessToken(accessToken);
    if (!resolvedToken && !mockEnabled) {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    if (!resolvedToken && !mockEnabled) return;
    if (signal?.aborted) return;
    try {
      const res = await getUsageModelBreakdown({
        baseUrl,
        accessToken: resolvedToken,
        from,
        to,
        timeZone,
        tzOffsetMinutes,
        signal,
      });
      if (signal?.aborted) return;
      setBreakdown(res || null);
      setSource("edge");
      setResolvedStorageKey(storageKey);
      writeDashboardLiveSnapshot("modelBreakdown", storageKey, {
        breakdown: res || null,
      });
      if (res && cacheAllowed) {
        writeCache({ breakdown: res, fetchedAt: new Date().toISOString() });
      } else if (!cacheAllowed) {
        clearCache();
      }
    } catch (e) {
      if (signal?.aborted || (e as any)?.name === "AbortError") return;
      if (cacheAllowed) {
        const cached = readCache();
        if (cached?.breakdown) {
          setBreakdown(cached.breakdown);
          setSource("cache");
          setError(null);
          setResolvedStorageKey(storageKey);
        } else {
          setSource("edge");
          const err = e as any;
          setError(err?.message || String(err));
        }
      } else {
        setSource("edge");
        const err = e as any;
        setError(err?.message || String(err));
      }
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    accessToken,
    applySnapshot,
    baseUrl,
    from,
    mockEnabled,
    guestAllowed,
    cacheAllowed,
    readCache,
    timeZone,
    to,
    tokenReady,
    tzOffsetMinutes,
    clearCache,
    storageKey,
    writeCache,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setBreakdown(null);
      setSource("edge");
      setError(null);
      setLoading(false);
      setRefreshing(false);
      setResolvedStorageKey(storageKey);
      return;
    }
    setLoading(true);
    if (!cacheAllowed) clearCache();
    setSource("edge");
    setError(null);
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

  return {
    breakdown: visibleBreakdown,
    source: mockEnabled ? "mock" : visibleSource,
    loading: visibleLoading,
    refreshing: visibleRefreshing,
    error: visibleError,
    refresh,
  };
}
