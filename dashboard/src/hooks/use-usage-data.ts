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
import { formatDateLocal, formatDateUTC } from "../lib/date-range";
import { isMockEnabled } from "../lib/mock-data";
import { getLocalDayKey, getTimeZoneCacheKey } from "../lib/timezone";
import { getUsageDaily, getUsageSummary } from "../lib/vibeusage-api";

export function useUsageData({
  baseUrl,
  accessToken,
  guestAllowed = false,
  from,
  to,
  includeDaily = true,
  cacheKey,
  timeZone,
  tzOffsetMinutes,
  now,
}: any = {}) {
  const [daily, setDaily] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [rolling, setRolling] = useState<any | null>(null);
  const [source, setSource] = useState<string>("edge");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedStorageKey, setResolvedStorageKey] = useState<string | null>(null);
  const mockEnabled = isMockEnabled();
  const tokenReady = isAccessTokenReady(accessToken);
  const cacheAllowed = !guestAllowed;
  const stableNow = useMemo(() => {
    if (now instanceof Date && Number.isFinite(now.getTime())) {
      return new Date(now.getTime());
    }
    return now;
  }, [now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : now]);

  const storageKey = buildDashboardCacheKey({
    scope: "usage",
    cacheKey,
    baseUrl,
    segments: [
      from,
      to,
      includeDaily ? "daily" : "summary",
      getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes }),
    ],
  });
  const liveSnapshot = storageKey ? readDashboardLiveSnapshot("usage", storageKey) : null;

  const readCache = useCallback(() => {
    return readDashboardCache(storageKey, (parsed) => Boolean(parsed?.summary));
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
    visibleStateRef.current = Boolean(summary) || Boolean(rolling) || daily.length > 0;
  }, [daily.length, rolling, summary]);

  const applySnapshot = useCallback((snapshot: any) => {
    if (!snapshot) return;
    setDaily(Array.isArray(snapshot.daily) ? snapshot.daily : []);
    setSummary(snapshot.summary || null);
    setRolling(snapshot.rolling || null);
    setFetchedAt(snapshot.fetchedAt || null);
    setSource("edge");
    setResolvedStorageKey(storageKey);
  }, [storageKey]);

  const snapshotDaily = Array.isArray(liveSnapshot?.daily) ? liveSnapshot.daily : [];
  const hasImmediateSnapshot =
    resolvedStorageKey !== storageKey &&
    Boolean(storageKey) &&
    (Boolean(liveSnapshot?.summary) || Boolean(liveSnapshot?.rolling) || snapshotDaily.length > 0);
  const visibleDaily = hasImmediateSnapshot ? snapshotDaily : daily;
  const visibleSummary = hasImmediateSnapshot ? liveSnapshot?.summary || null : summary;
  const visibleRolling = hasImmediateSnapshot ? liveSnapshot?.rolling || null : rolling;
  const visibleFetchedAt = hasImmediateSnapshot ? liveSnapshot?.fetchedAt || null : fetchedAt;
  const visibleSource = hasImmediateSnapshot ? "edge" : source;
  const visibleLoading = hasImmediateSnapshot ? false : loading;
  const visibleRefreshing = hasImmediateSnapshot ? true : refreshing;
  const visibleError = hasImmediateSnapshot ? null : error;

  const refresh = useCallback(async ({ signal }: any = {}) => {
    const snapshot = readDashboardLiveSnapshot("usage", storageKey);
    if (snapshot?.summary || snapshot?.rolling || Array.isArray(snapshot?.daily)) {
      applySnapshot(snapshot);
    }
    const hasVisibleState =
      Boolean(snapshot?.summary) || Boolean(snapshot?.rolling) || Array.isArray(snapshot?.daily)
        ? true
        : visibleStateRef.current;
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
      let dailyRes = null;
      let summaryRes = null;
      if (includeDaily) {
        const dailyPromise = getUsageDaily({
          baseUrl,
          accessToken: resolvedToken,
          from,
          to,
          timeZone,
          tzOffsetMinutes,
          signal,
        });
        const summaryPromise = getUsageSummary({
          baseUrl,
          accessToken: resolvedToken,
          from,
          to,
          timeZone,
          tzOffsetMinutes,
          signal,
        });
        const summaryResult = await summaryPromise.then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason }),
        );
        if (signal?.aborted) return;
        if (summaryResult.status === "fulfilled") {
          summaryRes = summaryResult.value;
          setSummary(summaryRes?.totals || null);
          setRolling(summaryRes?.rolling || null);
          setSource("edge");
          setLoading(false);
          setRefreshing(includeDaily);
          setResolvedStorageKey(storageKey);
        }
        dailyRes = await dailyPromise;
        if (signal?.aborted) return;
      } else {
        summaryRes = await getUsageSummary({
          baseUrl,
          accessToken: resolvedToken,
          from,
          to,
          timeZone,
          tzOffsetMinutes,
          signal,
        });
      }

      let nextDaily = includeDaily && Array.isArray(dailyRes?.data) ? dailyRes.data : [];
      if (includeDaily) {
        nextDaily = fillDailyGaps(nextDaily, from, to, {
          timeZone,
          offsetMinutes: tzOffsetMinutes,
          now: stableNow,
        });
      }
      let nextSummary = summaryRes?.totals || dailyRes?.summary?.totals || null;
      let nextRolling = summaryRes?.rolling || dailyRes?.summary?.rolling || null;
      if (includeDaily && !nextSummary && !summaryRes) {
        try {
          const fallback = await getUsageSummary({
            baseUrl,
            accessToken: resolvedToken,
            from,
            to,
            timeZone,
            tzOffsetMinutes,
            signal,
          });
          nextSummary = fallback?.totals || null;
          nextRolling = fallback?.rolling || nextRolling;
        } catch (_e) {
          // Ignore summary fallback errors when daily data is available.
        }
      }
      const nowIso = new Date().toISOString();
      if (signal?.aborted) return;

      setDaily(nextDaily);
      setSummary(nextSummary);
      setRolling(nextRolling);
      setSource("edge");
      setFetchedAt(nowIso);
      setLoading(false);
      setRefreshing(false);
      setResolvedStorageKey(storageKey);
      writeDashboardLiveSnapshot("usage", storageKey, {
        summary: nextSummary,
        rolling: nextRolling,
        daily: nextDaily,
        fetchedAt: nowIso,
      });

      if (nextSummary && cacheAllowed) {
        writeCache({
          summary: nextSummary,
          rolling: nextRolling,
          daily: nextDaily,
          from,
          to,
          includeDaily,
          fetchedAt: nowIso,
        });
      } else if (!cacheAllowed) {
        clearCache();
      }
    } catch (e) {
      if (signal?.aborted || (e as any)?.name === "AbortError") return;
      if (cacheAllowed) {
        const cached = readCache();
        if (cached?.summary) {
          setSummary(cached.summary);
          setRolling(cached.rolling || null);
          const cachedDaily = Array.isArray(cached.daily) ? cached.daily : [];
          const filledDaily = includeDaily
            ? fillDailyGaps(cachedDaily, cached.from || from, cached.to || to, {
                timeZone,
                offsetMinutes: tzOffsetMinutes,
                now: stableNow,
              })
            : cachedDaily;
          setDaily(filledDaily);
          setSource("cache");
          setFetchedAt(cached.fetchedAt || null);
          setError(null);
          setResolvedStorageKey(storageKey);
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
      setRefreshing(false);
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [
    applySnapshot,
    accessToken,
    baseUrl,
    from,
    includeDaily,
    mockEnabled,
    guestAllowed,
    cacheAllowed,
    stableNow,
    readCache,
    tokenReady,
    timeZone,
    to,
    tzOffsetMinutes,
    clearCache,
    storageKey,
    writeCache,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setDaily([]);
      setSummary(null);
      setRolling(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      setSource("edge");
      setFetchedAt(null);
      setResolvedStorageKey(storageKey);
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
    readCache,
    refresh,
    tokenReady,
    guestAllowed,
    cacheAllowed,
    clearCache,
  ]);

  const normalizedSource = mockEnabled ? "mock" : source;

  return {
    daily: visibleDaily,
    summary: visibleSummary,
    rolling: visibleRolling,
    source: mockEnabled ? "mock" : visibleSource,
    fetchedAt: visibleFetchedAt,
    loading: visibleLoading,
    refreshing: visibleRefreshing,
    error: visibleError,
    refresh,
  };
}

function parseUtcDate(yyyyMmDd: any) {
  if (!yyyyMmDd) return null;
  const raw = String(yyyyMmDd).trim();
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const dt = new Date(Date.UTC(y, m, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return formatDateUTC(dt) === raw ? dt : null;
}

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function fillDailyGaps(
  rows: any[],
  from: any,
  to: any,
  { timeZone, offsetMinutes, now }: any = {},
) {
  const start = parseUtcDate(from);
  const end = parseUtcDate(to);
  if (!start || !end || end < start) return Array.isArray(rows) ? rows : [];

  const baseDate = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const todayKey = getLocalDayKey({ timeZone, offsetMinutes, date: baseDate });
  const today = parseUtcDate(todayKey);
  const todayTime = today ? today.getTime() : baseDate.getTime();

  const byDay = new Map();
  for (const row of rows || []) {
    if (row?.day) byDay.set(row.day, row);
  }

  const filled = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const day = formatDateUTC(cursor);
    const existing = byDay.get(day);
    const isFuture = cursor.getTime() > todayTime;
    if (existing) {
      filled.push({ ...existing, missing: false, future: isFuture });
      continue;
    }
    filled.push({
      day,
      total_tokens: null,
      billable_total_tokens: null,
      input_tokens: null,
      cached_input_tokens: null,
      output_tokens: null,
      reasoning_output_tokens: null,
      missing: !isFuture,
      future: isFuture,
    });
  }

  return filled;
}
