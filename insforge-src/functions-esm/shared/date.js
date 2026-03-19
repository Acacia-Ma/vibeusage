import { getUsageMaxDays as readUsageMaxDays } from "./env.js";

const TIMEZONE_FORMATTERS = new Map();

export function isDate(value) {
  return typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);
}

export function toUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateUTC(date) {
  return toUtcDay(date).toISOString().slice(0, 10);
}

export function parseUtcDateString(value) {
  if (!isDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) return null;
  return formatDateUTC(date) === value ? date : null;
}

export function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function parseDateParts(value) {
  if (!isDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

export function formatDateParts(parts) {
  if (!parts) return null;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateFromPartsUTC(parts) {
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

export function addDatePartsDays(parts, days) {
  const base = dateFromPartsUTC(parts);
  if (!base) return null;
  return datePartsFromDateUTC(addUtcDays(base, days));
}

function parseOffsetMinutes(raw) {
  if (raw == null || raw === "") return null;
  const value = String(raw).trim();
  if (!/^-?\d+$/.test(value)) return null;
  const offset = Number(value);
  if (!Number.isFinite(offset) || offset < -840 || offset > 840) return null;
  return Math.trunc(offset);
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

export function getUsageTimeZoneContext(url) {
  if (!url?.searchParams) return normalizeTimeZone();
  return normalizeTimeZone(url.searchParams.get("tz"), url.searchParams.get("tz_offset_minutes"));
}

export function isUtcTimeZone(tzContext) {
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

export function getTimeZoneOffsetMinutes(date, timeZone) {
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

export function getLocalParts(date, tzContext) {
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

export function formatLocalDateKey(date, tzContext) {
  return formatDateParts(getLocalParts(date, tzContext));
}

export function localDatePartsToUtc(parts, tzContext) {
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
    if (offset2 !== offset) utc = baseUtc - offset2 * 60000;
    return new Date(utc);
  }
  const offsetMinutes = Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : 0;
  return new Date(baseUtc - offsetMinutes * 60000);
}

export function normalizeDateRangeLocal(fromRaw, toRaw, tzContext) {
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

export function listDateStrings(from, to) {
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

export function getUsageMaxDays() {
  return readUsageMaxDays();
}
