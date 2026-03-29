"use strict";

const CORE_KEY = "__vibeusageUsageDailyCore";
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

const { formatLocalDateKey } = dateCore;
const { toBigInt } = runtimePrimitivesCore;

function initDailyBuckets(dayKeys) {
  const buckets = new Map(
    (Array.isArray(dayKeys) ? dayKeys : []).map((day) => [
      day,
      {
        total: 0n,
        billable: 0n,
        input: 0n,
        cached: 0n,
        output: 0n,
        reasoning: 0n,
      },
    ]),
  );
  return { buckets };
}

function applyDailyBucket({ buckets, row, tzContext, billable }) {
  const ts = row?.hour_start;
  if (!ts) return false;
  const dt = new Date(ts);
  if (!Number.isFinite(dt.getTime())) return false;
  const day = formatLocalDateKey(dt, tzContext);
  const bucket = buckets?.get?.(day) || null;
  if (!bucket) return false;

  bucket.total += toBigInt(row?.total_tokens);
  bucket.billable += toBigInt(billable);
  bucket.input += toBigInt(row?.input_tokens);
  bucket.cached += toBigInt(row?.cached_input_tokens);
  bucket.output += toBigInt(row?.output_tokens);
  bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
  return true;
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      initDailyBuckets,
      applyDailyBucket,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
