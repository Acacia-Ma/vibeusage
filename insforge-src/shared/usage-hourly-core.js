"use strict";

require("./runtime-primitives-core");

const CORE_KEY = "__vibeusageUsageHourlyCore";

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

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
    const row = {
      hour: key,
      total_tokens: bucket.total.toString(),
      billable_total_tokens: bucket.billable.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString(),
    };
    if (typeof missingAfterSlot === "number") {
      const slot = parseHalfHourSlotFromKey(key);
      if (Number.isFinite(slot) && slot > missingAfterSlot) row.missing = true;
    }
    return row;
  });
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
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
