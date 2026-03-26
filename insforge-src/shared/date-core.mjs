"use strict";

const CORE_KEY = "__vibeusageDateCore";
const envCore = globalThis.__vibeusageEnvCore;
if (!envCore) throw new Error("env core not initialized");

const TIMEZONE_FORMATTERS = new Map();

function isDate(value) {
  return typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);
}

function toUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateUTC(date) {
  return toUtcDay(date).toISOString().slice(0, 10);
}

function normalizeIso(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dt = new Date(trimmed);
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toISOString();
}

function normalizeDateRange(fromRaw, toRaw) {
  const today = new Date();
  const toDefault = formatDateUTC(today);
  const fromDefault = formatDateUTC(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 29)),
  );

  const from = isDate(fromRaw) ? fromRaw : fromDefault;
  const to = isDate(toRaw) ? toRaw : toDefault;
  return { from, to };
}

function parseUtcDateString(value) {
  if (!isDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) return null;
  return formatDateUTC(date) === value ? date : null;
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function computeHeatmapWindowUtc({ weeks, weekStartsOn, to }) {
  const end = parseUtcDateString(to) || new Date();
  const desired = weekStartsOn === "mon" ? 1 : 0;
  const endDow = end.getUTCDay();
  const endWeekStart = addUtcDays(end, -((endDow - desired + 7) % 7));
  const gridStart = addUtcDays(endWeekStart, -7 * (weeks - 1));
  return { from: formatDateUTC(gridStart), gridStart, end };
}

function getTimeZoneFormatter(timeZone) {
  if (TIMEZONE_FORMATTERS.has(timeZone)) return TIMEZONE_FORMATTERS.get(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  TIMEZONE_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function parseDateParts(value) {
  if (!isDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function formatDateParts(parts) {
  if (!parts) return null;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateFromPartsUTC(parts) {
  if (!parts) return null;
  const year = Number(parts.year);
  const month = Number(parts.month) - 1;
  const day = Number(parts.day);
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  const second = Number(parts.second || 0);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

function datePartsFromDateUTC(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function addDatePartsDays(parts, days) {
  const base = dateFromPartsUTC(parts);
  if (!base) return null;
  return datePartsFromDateUTC(addUtcDays(base, days));
}

function addDatePartsMonths(parts, months) {
  if (!parts) return null;
  const year = Number(parts.year);
  const month = Number(parts.month) - 1 + Number(months || 0);
  const day = Number(parts.day || 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const dt = new Date(Date.UTC(year, month, day));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function parseOffsetMinutes(raw) {
  if (raw == null || raw === "") return null;
  const value = String(raw).trim();
  if (!/^-?\d+$/.test(value)) return null;
  const offset = Number(value);
  if (!Number.isFinite(offset) || offset < -840 || offset > 840) return null;
  return Math.trunc(offset);
}

function normalizeTimeZone(tzRaw, offsetRaw) {
  const timeZoneValue = typeof tzRaw === "string" ? tzRaw.trim() : "";
  let timeZone = null;
  if (timeZoneValue) {
    try {
      getTimeZoneFormatter(timeZoneValue).format(new Date(0));
      timeZone = timeZoneValue;
    } catch (_error) {
      timeZone = null;
    }
  }
  const offsetMinutes = parseOffsetMinutes(offsetRaw);
  if (timeZone) return { timeZone, offsetMinutes: null, source: "iana" };
  if (offsetMinutes != null) return { timeZone: null, offsetMinutes, source: "offset" };
  return { timeZone: null, offsetMinutes: 0, source: "utc" };
}

function getUsageTimeZoneContext(url) {
  if (!url?.searchParams) return normalizeTimeZone();
  return normalizeTimeZone(url.searchParams.get("tz"), url.searchParams.get("tz_offset_minutes"));
}

function isUtcTimeZone(tzContext) {
  if (!tzContext) return true;
  const tz = tzContext.timeZone;
  if (tz) {
    const upper = tz.toUpperCase();
    return upper === "UTC" || upper === "ETC/UTC" || upper === "ETC/GMT";
  }
  return Number(tzContext.offsetMinutes || 0) === 0;
}

function getTimeZoneParts(date, timeZone) {
  const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    if (part.type === "month") month = Number(part.value);
    if (part.type === "day") day = Number(part.value);
    if (part.type === "hour") hour = Number(part.value);
    if (part.type === "minute") minute = Number(part.value);
    if (part.type === "second") second = Number(part.value);
  }
  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function getLocalParts(date, tzContext) {
  if (tzContext?.timeZone) {
    return getTimeZoneParts(date, tzContext.timeZone);
  }
  const offsetMinutes = Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : 0;
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function formatLocalDateKey(date, tzContext) {
  return formatDateParts(getLocalParts(date, tzContext));
}

function localDatePartsToUtc(parts, tzContext) {
  const baseUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour || 0),
    Number(parts.minute || 0),
    Number(parts.second || 0),
  );
  if (tzContext?.timeZone) {
    let offset = getTimeZoneOffsetMinutes(new Date(baseUtc), tzContext.timeZone);
    let utc = baseUtc - offset * 60000;
    const offset2 = getTimeZoneOffsetMinutes(new Date(utc), tzContext.timeZone);
    if (offset2 !== offset) {
      utc = baseUtc - offset2 * 60000;
    }
    return new Date(utc);
  }
  const offsetMinutes = Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : 0;
  return new Date(baseUtc - offsetMinutes * 60000);
}

function normalizeDateRangeLocal(fromRaw, toRaw, tzContext) {
  const todayParts = getLocalParts(new Date(), tzContext);
  const toDefault = formatDateParts(todayParts);
  const fromDefault = formatDateParts(
    addDatePartsDays(
      { year: todayParts.year, month: todayParts.month, day: todayParts.day },
      -29,
    ),
  );
  return {
    from: isDate(fromRaw) ? fromRaw : fromDefault,
    to: isDate(toRaw) ? toRaw : toDefault,
  };
}

function listDateStrings(from, to) {
  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) return [];
  const start = dateFromPartsUTC(startParts);
  const end = dateFromPartsUTC(endParts);
  if (!start || !end || end < start) return [];
  const days = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    days.push(formatDateUTC(cursor));
  }
  return days;
}

function resolveUsageDateRangeLocal({ fromRaw, toRaw, tzContext, maxDays } = {}) {
  const resolvedMaxDays = Number.isFinite(maxDays) ? maxDays : getUsageMaxDays();
  const { from, to } = normalizeDateRangeLocal(fromRaw, toRaw, tzContext);
  const dayKeys = listDateStrings(from, to);
  if (dayKeys.length > resolvedMaxDays) {
    return {
      ok: false,
      error: `Date range too large (max ${resolvedMaxDays} days)`,
    };
  }

  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) {
    return {
      ok: false,
      error: "Invalid date range",
    };
  }

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(endParts, 1), tzContext);
  if (!Number.isFinite(startUtc.getTime()) || !Number.isFinite(endUtc.getTime())) {
    return {
      ok: false,
      error: "Invalid date range",
    };
  }

  return {
    ok: true,
    from,
    to,
    dayKeys,
    startParts,
    endParts,
    startUtc,
    endUtc,
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
    maxDays: resolvedMaxDays,
  };
}

function getUsageMaxDays() {
  return envCore.getUsageMaxDays();
}

function isWithinInterval(lastSyncAt, minutes, nowIso) {
  const lastIso = normalizeIso(lastSyncAt);
  if (!lastIso) return false;
  const lastMs = Date.parse(lastIso);
  if (!Number.isFinite(lastMs)) return false;
  const windowMs = Math.max(0, minutes) * 60 * 1000;
  if (windowMs <= 0) return false;
  const nowValue = nowIso == null ? Date.now() : Date.parse(normalizeIso(nowIso) || "");
  if (!Number.isFinite(nowValue)) return false;
  return nowValue - lastMs < windowMs;
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      isDate,
      toUtcDay,
      formatDateUTC,
      normalizeIso,
      normalizeDateRange,
      parseUtcDateString,
      addUtcDays,
      computeHeatmapWindowUtc,
      parseDateParts,
      formatDateParts,
      dateFromPartsUTC,
      datePartsFromDateUTC,
      addDatePartsDays,
      addDatePartsMonths,
      normalizeTimeZone,
      getUsageTimeZoneContext,
      isUtcTimeZone,
      getTimeZoneOffsetMinutes,
      getLocalParts,
      formatLocalDateKey,
      localDatePartsToUtc,
      normalizeDateRangeLocal,
      listDateStrings,
      resolveUsageDateRangeLocal,
      getUsageMaxDays,
      isWithinInterval,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
