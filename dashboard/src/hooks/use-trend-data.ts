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
import { getUsageDaily, getUsageHourly, getUsageMonthly } from "../lib/vibeusage-api";

const DEFAULT_MONTHS = 24;
type AnyRecord = Record<string, any>;

export function useTrendData({
  baseUrl,
  accessToken,
  guestAllowed = false,
  period,
  from,
  to,
  months = DEFAULT_MONTHS,
  cacheKey,
  timeZone,
  tzOffsetMinutes,
  now,
}: any = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [range, setRange] = useState<{ from?: any; to?: any }>(() => ({ from, to }));
  const [source, setSource] = useState<string>("edge");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedStorageKey, setResolvedStorageKey] = useState<string | null>(null);
  const mockEnabled = isMockEnabled();
  const tokenReady = isAccessTokenReady(accessToken);
  const cacheAllowed = !guestAllowed;

  const mode = useMemo(() => {
    if (period === "day") return "hourly";
    if (period === "total") return "monthly";
    return "daily";
  }, [period]);

  const storageKey = buildDashboardCacheKey({
    scope: "trend",
    cacheKey,
    baseUrl,
    segments:
      mode === "hourly"
        ? ["hourly", to || from || "day", getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes })]
        : mode === "monthly"
          ? [
              "monthly",
              months,
              to || "today",
              getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes }),
            ]
          : ["daily", from || "", to || "", getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes })],
  });
  const liveSnapshot = storageKey ? readDashboardLiveSnapshot("trend", storageKey) : null;

  const readCache = useCallback(() => {
    return readDashboardCache(storageKey, (parsed) => Array.isArray(parsed?.rows));
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
    visibleStateRef.current = rows.length > 0;
  }, [rows.length]);

  const applySnapshot = useCallback((snapshot: any) => {
    if (!snapshot) return;
    setRows(Array.isArray(snapshot.rows) ? snapshot.rows : []);
    setRange({ from: snapshot.from || from, to: snapshot.to || to });
    setFetchedAt(snapshot.fetchedAt || null);
    setSource("edge");
    setResolvedStorageKey(storageKey);
  }, [from, storageKey, to]);

  const snapshotRows = Array.isArray(liveSnapshot?.rows) ? liveSnapshot.rows : [];
  const hasImmediateSnapshot =
    resolvedStorageKey !== storageKey &&
    Boolean(storageKey) &&
    snapshotRows.length > 0;
  const visibleRows = hasImmediateSnapshot ? snapshotRows : rows;
  const visibleRange = hasImmediateSnapshot
    ? { from: liveSnapshot?.from || from, to: liveSnapshot?.to || to }
    : range;
  const visibleFetchedAt = hasImmediateSnapshot ? liveSnapshot?.fetchedAt || null : fetchedAt;
  const visibleSource = hasImmediateSnapshot ? "edge" : source;
  const visibleLoading = hasImmediateSnapshot ? false : loading;
  const visibleRefreshing = hasImmediateSnapshot ? true : refreshing;
  const visibleError = hasImmediateSnapshot ? null : error;

  const refresh = useCallback(async ({ signal }: any = {}) => {
    const snapshot = readDashboardLiveSnapshot("trend", storageKey);
    if (snapshot?.rows) {
      applySnapshot(snapshot);
    }
    const hasVisibleState = Array.isArray(snapshot?.rows) ? true : visibleStateRef.current;
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
      let response;
      if (mode === "hourly") {
        const day = to || from;
        response = await getUsageHourly({
          baseUrl,
          accessToken: resolvedToken,
          day,
          timeZone,
          tzOffsetMinutes,
          signal,
        });
      } else if (mode === "monthly") {
        response = await getUsageMonthly({
          baseUrl,
          accessToken: resolvedToken,
          months,
          to,
          timeZone,
          tzOffsetMinutes,
          signal,
        });
      } else {
        response = await getUsageDaily({
          baseUrl,
          accessToken: resolvedToken,
          from,
          to,
          timeZone,
          tzOffsetMinutes,
          signal,
        });
      }
      if (signal?.aborted) return;

      const nextFrom = response?.from || from || response?.day || null;
      const nextTo = response?.to || to || response?.day || null;
      let nextRows = Array.isArray(response?.data) ? response.data : [];
      if (mode === "daily") {
        nextRows = fillDailyGaps(nextRows, nextFrom || from, nextTo || to, {
          timeZone,
          offsetMinutes: tzOffsetMinutes,
          now,
        });
      } else if (mode === "hourly") {
        nextRows = markHourlyFuture(nextRows, {
          timeZone,
          offsetMinutes: tzOffsetMinutes,
          now,
        });
      } else if (mode === "monthly") {
        nextRows = markMonthlyFuture(nextRows, {
          timeZone,
          offsetMinutes: tzOffsetMinutes,
          now,
        });
      }
      const nowIso = new Date().toISOString();
      if (signal?.aborted) return;

      setRows(nextRows);
      setRange({ from: nextFrom, to: nextTo });
      setSource("edge");
      setFetchedAt(nowIso);
      setResolvedStorageKey(storageKey);
      writeDashboardLiveSnapshot("trend", storageKey, {
        rows: nextRows,
        from: nextFrom,
        to: nextTo,
        fetchedAt: nowIso,
      });

      if (cacheAllowed) {
        writeCache({
          rows: nextRows,
          from: nextFrom,
          to: nextTo,
          mode,
          fetchedAt: nowIso,
        });
      } else {
        clearCache();
      }
    } catch (e) {
      if (signal?.aborted || (e as any)?.name === "AbortError") return;
      if (cacheAllowed) {
        const cached = readCache();
        if (cached?.rows) {
          let filledRows =
            mode === "daily"
              ? fillDailyGaps(cached.rows || [], cached.from || from, cached.to || to, {
                  timeZone,
                  offsetMinutes: tzOffsetMinutes,
                  now,
                })
              : Array.isArray(cached.rows)
                ? cached.rows
                : [];
          if (mode === "hourly") {
            filledRows = markHourlyFuture(filledRows, {
              timeZone,
              offsetMinutes: tzOffsetMinutes,
              now,
            });
          } else if (mode === "monthly") {
            filledRows = markMonthlyFuture(filledRows, {
              timeZone,
              offsetMinutes: tzOffsetMinutes,
              now,
            });
          }
          setRows(filledRows);
          setRange({ from: cached.from || from, to: cached.to || to });
          setSource("cache");
          setFetchedAt(cached.fetchedAt || null);
          setError(null);
          setResolvedStorageKey(storageKey);
        } else {
          setSource("edge");
          setFetchedAt(null);
          const err = e as any;
          setError(err?.message || String(err));
        }
      } else {
        setSource("edge");
        setFetchedAt(null);
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
    mode,
    months,
    readCache,
    timeZone,
    to,
    tzOffsetMinutes,
    now,
    clearCache,
    storageKey,
    writeCache,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setRows([]);
      setRange({ from, to });
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
    refresh,
    tokenReady,
    guestAllowed,
    cacheAllowed,
    clearCache,
  ]);

  return {
    rows: visibleRows,
    from: visibleRange.from || from,
    to: visibleRange.to || to,
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

function markHourlyFuture(rows: any[], { timeZone, offsetMinutes, now }: any = {}) {
  if (!Array.isArray(rows)) return [];
  const nowParts = getNowParts({ timeZone, offsetMinutes, now });
  if (!nowParts) return rows;

  return rows.map((row) => {
    const label = row?.hour || row?.label || "";
    const parsed = parseHourLabel(label);
    if (!parsed) {
      return { ...row, future: false };
    }
    const isFuture =
      parsed.dayNum > nowParts.dayNum ||
      (parsed.dayNum === nowParts.dayNum && parsed.slot > nowParts.slot);
    return { ...row, future: isFuture };
  });
}

function markMonthlyFuture(rows: any[], { timeZone, offsetMinutes, now }: any = {}) {
  if (!Array.isArray(rows)) return [];
  const nowParts = getNowParts({ timeZone, offsetMinutes, now });
  if (!nowParts) return rows;

  return rows.map((row) => {
    const label = row?.month || row?.label || "";
    const parsed = parseMonthLabel(label);
    if (!parsed) {
      return { ...row, future: false };
    }
    const isFuture =
      parsed.year > nowParts.year ||
      (parsed.year === nowParts.year && parsed.month > nowParts.month);
    return { ...row, future: isFuture };
  });
}

function getNowParts({ timeZone, offsetMinutes, now }: any = {}) {
  const baseDate = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  if (timeZone && typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      const parts = formatter.formatToParts(baseDate);
      const values = parts.reduce((acc: AnyRecord, part: any) => {
        if (part.type && part.value) acc[part.type] = part.value;
        return acc;
      }, {} as AnyRecord);
      const year = Number(values.year);
      const month = Number(values.month);
      const day = Number(values.day);
      const hour = Number(values.hour);
      const minute = Number(values.minute);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute)
      ) {
        const slot = hour * 2 + (minute >= 30 ? 1 : 0);
        return {
          year,
          month,
          day,
          hour,
          minute,
          dayNum: year * 10000 + month * 100 + day,
          slot,
        };
      }
    } catch (_e) {
      // fallback below
    }
  }

  if (Number.isFinite(offsetMinutes)) {
    const shifted = new Date(baseDate.getTime() + offsetMinutes * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth() + 1;
    const day = shifted.getUTCDate();
    const hour = shifted.getUTCHours();
    const minute = shifted.getUTCMinutes();
    const slot = hour * 2 + (minute >= 30 ? 1 : 0);
    return {
      year,
      month,
      day,
      hour,
      minute,
      dayNum: year * 10000 + month * 100 + day,
      slot,
    };
  }

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + 1;
  const day = baseDate.getDate();
  const hour = baseDate.getHours();
  const minute = baseDate.getMinutes();
  const slot = hour * 2 + (minute >= 30 ? 1 : 0);
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayNum: year * 10000 + month * 100 + day,
    slot,
  };
}

function parseHourLabel(label: any) {
  if (!label) return null;
  const raw = String(label).trim();
  const [datePart, timePart] = raw.split("T");
  if (!datePart || !timePart) return null;
  const dateParts = datePart.split("-");
  if (dateParts.length !== 3) return null;
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const timeParts = timePart.split(":");
  const hour = Number(timeParts[0]);
  const minute = Number(timeParts[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  const slot = hour * 2 + (minute >= 30 ? 1 : 0);
  return {
    dayNum: year * 10000 + month * 100 + day,
    slot,
  };
}

function parseMonthLabel(label: any) {
  if (!label) return null;
  const raw = String(label).trim();
  const parts = raw.split("-");
  if (parts.length !== 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}
