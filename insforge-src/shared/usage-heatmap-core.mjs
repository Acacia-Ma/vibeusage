"use strict";

import "./date-core.mjs";

const CORE_KEY = "__vibeusageUsageHeatmapCore";
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");

const {
  addDatePartsDays,
  addUtcDays,
  computeHeatmapWindowUtc,
  dateFromPartsUTC,
  formatDateParts,
  formatDateUTC,
  getLocalParts,
  isUtcTimeZone,
  localDatePartsToUtc,
  parseDateParts,
  parseUtcDateString,
} = dateCore;

function accumulateHeatmapDayValue({ valuesByDay, dayKey, billable } = {}) {
  if (!(valuesByDay instanceof Map)) throw new Error("valuesByDay map is required");
  if (typeof dayKey !== "string" || !dayKey) throw new Error("valid dayKey is required");
  if (typeof billable !== "bigint") throw new Error("billable bigint is required");
  const nextValue = (valuesByDay.get(dayKey) || 0n) + billable;
  valuesByDay.set(dayKey, nextValue);
  return nextValue;
}

function normalizeHeatmapWeeks(raw) {
  if (raw == null || raw === "") return 52;
  const value = String(raw).trim();
  if (!/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 104) return null;
  return parsed;
}

function normalizeHeatmapWeekStartsOn(raw) {
  const value = (raw == null || raw === "" ? "sun" : String(raw)).trim().toLowerCase();
  if (value === "sun" || value === "mon") return value;
  return null;
}

function normalizeHeatmapToDate(raw) {
  if (raw == null || raw === "") return formatDateUTC(new Date());
  const value = String(raw).trim();
  const dt = parseUtcDateString(value);
  return dt ? formatDateUTC(dt) : null;
}

function resolveUsageHeatmapRequestContext({ url, tzContext, now = new Date() } = {}) {
  const weeks = normalizeHeatmapWeeks(url?.searchParams?.get("weeks"));
  if (!weeks) return { ok: false, status: 400, error: "Invalid weeks" };

  const weekStartsOn = normalizeHeatmapWeekStartsOn(url?.searchParams?.get("week_starts_on"));
  if (!weekStartsOn) return { ok: false, status: 400, error: "Invalid week_starts_on" };

  const toRaw = url?.searchParams?.get("to");
  if (isUtcTimeZone(tzContext)) {
    const to = normalizeHeatmapToDate(toRaw);
    if (!to) return { ok: false, status: 400, error: "Invalid to" };

    const { from, gridStart, end } = computeHeatmapWindowUtc({ weeks, weekStartsOn, to });
    return {
      ok: true,
      timeMode: "utc",
      weeks,
      weekStartsOn,
      from,
      to,
      gridStart,
      end,
      startIso: gridStart.toISOString(),
      endIso: addUtcDays(end, 1).toISOString(),
    };
  }

  const todayParts = getLocalParts(now, tzContext);
  const toParts = toRaw
    ? parseDateParts(toRaw)
    : {
        year: todayParts.year,
        month: todayParts.month,
        day: todayParts.day,
      };
  if (!toParts) return { ok: false, status: 400, error: "Invalid to" };

  const end = dateFromPartsUTC(toParts);
  if (!end) return { ok: false, status: 400, error: "Invalid to" };

  const desired = weekStartsOn === "mon" ? 1 : 0;
  const endDow = end.getUTCDay();
  const endWeekStart = addUtcDays(end, -((endDow - desired + 7) % 7));
  const gridStart = addUtcDays(endWeekStart, -7 * (weeks - 1));
  const from = formatDateUTC(gridStart);
  const to = formatDateParts(toParts);
  const startParts = parseDateParts(from);
  if (!startParts || !to) return { ok: false, status: 400, error: "Invalid to" };

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  if (!Number.isFinite(startUtc.getTime()) || !Number.isFinite(endUtc.getTime())) {
    return { ok: false, status: 400, error: "Invalid to" };
  }

  return {
    ok: true,
    timeMode: "local",
    weeks,
    weekStartsOn,
    from,
    to,
    gridStart,
    end,
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  };
}

function quantileNearestRank(sortedBigints, q) {
  if (!Array.isArray(sortedBigints) || sortedBigints.length === 0) return 0n;
  const n = sortedBigints.length;
  const pos = Math.floor((n - 1) * q);
  const idx = Math.min(n - 1, Math.max(0, pos));
  return sortedBigints[idx] || 0n;
}

function computeActiveStreakDays({ valuesByDay, to, getDayKey } = {}) {
  if (!(valuesByDay instanceof Map) || !(to instanceof Date) || typeof getDayKey !== "function") {
    return 0;
  }
  let streak = 0;
  for (let i = 0; i < 370; i += 1) {
    const key = getDayKey(addUtcDays(to, -i));
    const value = valuesByDay.get(key) || 0n;
    if (value > 0n) streak += 1;
    else break;
  }
  return streak;
}

function buildUsageHeatmapPayload({
  valuesByDay,
  gridStart,
  end,
  weeks,
  from,
  to,
  weekStartsOn,
  getDayKey,
  renderDay,
} = {}) {
  if (!(valuesByDay instanceof Map)) throw new Error("valuesByDay map is required");
  if (!(gridStart instanceof Date) || !Number.isFinite(gridStart.getTime())) {
    throw new Error("valid gridStart date is required");
  }
  if (!(end instanceof Date) || !Number.isFinite(end.getTime())) {
    throw new Error("valid end date is required");
  }
  if (!Number.isFinite(weeks) || weeks < 1) throw new Error("valid weeks count is required");
  if (typeof getDayKey !== "function") throw new Error("getDayKey callback is required");
  const renderDayLabel = typeof renderDay === "function" ? renderDay : getDayKey;

  const nz = [];
  let activeDays = 0;
  for (let i = 0; i < weeks * 7; i += 1) {
    const dt = addUtcDays(gridStart, i);
    if (dt.getTime() > end.getTime()) break;
    const value = valuesByDay.get(getDayKey(dt)) || 0n;
    if (value > 0n) {
      activeDays += 1;
      nz.push(value);
    }
  }

  nz.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const t1 = quantileNearestRank(nz, 0.5);
  const t2 = quantileNearestRank(nz, 0.75);
  const t3 = quantileNearestRank(nz, 0.9);

  const levelFor = (value) => {
    if (!value || value <= 0n) return 0;
    if (value <= t1) return 1;
    if (value <= t2) return 2;
    if (value <= t3) return 3;
    return 4;
  };

  const weeksOut = [];
  for (let w = 0; w < weeks; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const dt = addUtcDays(gridStart, w * 7 + d);
      if (dt.getTime() > end.getTime()) {
        week.push(null);
        continue;
      }
      const dayKey = getDayKey(dt);
      const value = valuesByDay.get(dayKey) || 0n;
      week.push({
        day: renderDayLabel(dt),
        value: value.toString(),
        level: levelFor(value),
      });
    }
    weeksOut.push(week);
  }

  return {
    from,
    to,
    week_starts_on: weekStartsOn,
    thresholds: { t1: t1.toString(), t2: t2.toString(), t3: t3.toString() },
    active_days: activeDays,
    streak_days: computeActiveStreakDays({ valuesByDay, to: end, getDayKey }),
    weeks: weeksOut,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      accumulateHeatmapDayValue,
      buildUsageHeatmapPayload,
      computeActiveStreakDays,
      resolveUsageHeatmapRequestContext,
      normalizeHeatmapToDate,
      normalizeHeatmapWeekStartsOn,
      normalizeHeatmapWeeks,
      quantileNearestRank,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
