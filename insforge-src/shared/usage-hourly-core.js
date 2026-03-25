"use strict";

require("./date-core");
require("./runtime-primitives-core");
require("./usage-metrics-core");

const CORE_KEY = "__vibeusageUsageHourlyCore";

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

const {
  addDatePartsDays,
  addUtcDays,
  formatDateParts,
  formatDateUTC,
  getLocalParts,
  isUtcTimeZone,
  localDatePartsToUtc,
  parseDateParts,
  parseUtcDateString,
} = dateCore;

function createHourlyBucket() {
  return {
    total: 0n,
    billable: 0n,
    input: 0n,
    cached: 0n,
    output: 0n,
    reasoning: 0n,
  };
}

function resolveHalfHourSlot({ hour, minute } = {}) {
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (!Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber)) return null;
  if (hourNumber < 0 || hourNumber > 23) return null;
  if (minuteNumber < 0 || minuteNumber > 59) return null;
  return hourNumber * 2 + (minuteNumber >= 30 ? 1 : 0);
}

function createHourlyBuckets(dayLabel) {
  const hourKeys = [];
  const buckets = Array.from({ length: 48 }, () => createHourlyBucket());
  const bucketMap = new Map();

  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const key = `${dayLabel}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
      hourKeys.push(key);
      const slot = resolveHalfHourSlot({ hour, minute });
      bucketMap.set(key, buckets[slot]);
    }
  }

  return { hourKeys, buckets, bucketMap };
}

function addHourlyBucketTotals({
  bucket,
  totalTokens,
  billableTokens,
  inputTokens,
  cachedInputTokens,
  outputTokens,
  reasoningOutputTokens,
} = {}) {
  if (!bucket) return bucket;
  bucket.total += runtimePrimitivesCore.toBigInt(totalTokens);
  bucket.billable += runtimePrimitivesCore.toBigInt(billableTokens);
  bucket.input += runtimePrimitivesCore.toBigInt(inputTokens);
  bucket.cached += runtimePrimitivesCore.toBigInt(cachedInputTokens);
  bucket.output += runtimePrimitivesCore.toBigInt(outputTokens);
  bucket.reasoning += runtimePrimitivesCore.toBigInt(reasoningOutputTokens);
  return bucket;
}

function formatHourKeyFromValue(value) {
  if (!value) return null;
  if (typeof value === "string" && value.length >= 16) {
    const day = value.slice(0, 10);
    const hour = value.slice(11, 13);
    const minute = value.slice(14, 16);
    const minuteNum = Number(minute);
    if (Number.isFinite(minuteNum) && (minuteNum === 0 || minuteNum === 30) && day && hour) {
      return `${day}T${hour}:${minute}:00`;
    }
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  const day = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
  const hour = String(dt.getUTCHours()).padStart(2, "0");
  const minute = String(dt.getUTCMinutes() >= 30 ? 30 : 0).padStart(2, "0");
  return `${day}T${hour}:${minute}:00`;
}

function parseHalfHourSlotFromKey(key) {
  if (typeof key !== "string" || key.length < 16) return null;
  const hour = key.slice(11, 13);
  const minute = key.slice(14, 16);
  return resolveHalfHourSlot({ hour, minute });
}

function buildHourlyResponse(hourKeys, bucketMap, missingAfterSlot) {
  return hourKeys.map((key) => {
    const bucket = bucketMap.get(key) || createHourlyBucket();
    const row = usageMetricsCore.buildUsageBucketPayload(bucket, { hour: key });
    if (typeof missingAfterSlot === "number") {
      const slot = parseHalfHourSlotFromKey(key);
      if (Number.isFinite(slot) && slot > missingAfterSlot) row.missing = true;
    }
    return row;
  });
}

function resolveUsageHourlyRequestContext({ url, tzContext, now = new Date() } = {}) {
  const dayRaw = url?.searchParams?.get("day");
  if (isUtcTimeZone(tzContext)) {
    const today = parseUtcDateString(formatDateUTC(now));
    const day = dayRaw ? parseUtcDateString(dayRaw) : today;
    if (!day) return { ok: false, status: 400, error: "Invalid day" };

    const startUtc = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0),
    );
    const endDate = addUtcDays(day, 1);
    const endUtc = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0),
    );
    return {
      ok: true,
      timeMode: "utc",
      dayKey: formatDateUTC(day),
      startUtc,
      endUtc,
      startIso: startUtc.toISOString(),
      endIso: endUtc.toISOString(),
    };
  }

  if (dayRaw && !parseDateParts(dayRaw)) return { ok: false, status: 400, error: "Invalid day" };
  const todayKey = formatDateParts(getLocalParts(now, tzContext));
  const dayKey = dayRaw || todayKey;
  const dayParts = parseDateParts(dayKey);
  if (!dayParts) return { ok: false, status: 400, error: "Invalid day" };

  const startUtc = localDatePartsToUtc({ ...dayParts, hour: 0, minute: 0, second: 0 }, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(dayParts, 1), tzContext);
  return {
    ok: true,
    timeMode: "local",
    dayKey,
    startUtc,
    endUtc,
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  };
}

function resolveUsageHourlyRowSlot({ usageDate, timeMode, dayKey, tzContext } = {}) {
  if (!(usageDate instanceof Date) || !Number.isFinite(usageDate.getTime())) return null;
  if (timeMode === "utc") {
    return resolveHalfHourSlot({
      hour: usageDate.getUTCHours(),
      minute: usageDate.getUTCMinutes(),
    });
  }

  const localParts = getLocalParts(usageDate, tzContext);
  const localDay = formatDateParts(localParts);
  if (localDay !== dayKey) return null;
  return resolveHalfHourSlot({ hour: localParts.hour, minute: localParts.minute });
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      createHourlyBucket,
      resolveHalfHourSlot,
      createHourlyBuckets,
      addHourlyBucketTotals,
      formatHourKeyFromValue,
      parseHalfHourSlotFromKey,
      buildHourlyResponse,
      resolveUsageHourlyRequestContext,
      resolveUsageHourlyRowSlot,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
