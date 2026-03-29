import "../date.js";
import "../numbers.js";
import "../../../shared/usage-daily-core.mjs";

const usageDailyCore = globalThis.__vibeusageUsageDailyCore;
if (!usageDailyCore) throw new Error("usage daily core not initialized");

export const initDailyBuckets = usageDailyCore.initDailyBuckets;
export const applyDailyBucket = usageDailyCore.applyDailyBucket;
