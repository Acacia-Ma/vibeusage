import { useCallback, useEffect, useMemo, useState } from "react";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import {
  buildDashboardCacheKey,
  clearDashboardCache,
  readDashboardCache,
  writeDashboardCache,
} from "../lib/dashboard-cache";
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
  const [error, setError] = useState<string | null>(null);
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

  const refresh = useCallback(async ({ signal }: any = {}) => {
    const resolvedToken = await resolveAuthAccessToken(accessToken);
    if (!resolvedToken && !mockEnabled) return;
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
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
        } else {
          setBreakdown(null);
          setSource("edge");
          const err = e as any;
          setError(err?.message || String(err));
        }
      } else {
        setBreakdown(null);
        setSource("edge");
        const err = e as any;
        setError(err?.message || String(err));
      }
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [
    accessToken,
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
    writeCache,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setBreakdown(null);
      setSource("edge");
      setError(null);
      setLoading(false);
      return;
    }
    if (!cacheAllowed) {
      clearCache();
      setBreakdown(null);
      setSource("edge");
      setError(null);
    } else {
      const cached = readCache();
      if (cached?.breakdown) {
        setBreakdown(cached.breakdown);
        setSource("cache");
        setError(null);
      } else if (tokenReady || !guestAllowed || mockEnabled) {
        setBreakdown(null);
        setSource("edge");
        setError(null);
      }
    }
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [
    accessToken,
    mockEnabled,
    readCache,
    refresh,
    tokenReady,
    guestAllowed,
    cacheAllowed,
    clearCache,
  ]);

  const normalizedSource = mockEnabled ? "mock" : source;

  return {
    breakdown,
    source: normalizedSource,
    loading,
    error,
    refresh,
  };
}
