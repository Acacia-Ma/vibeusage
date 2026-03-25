import "../numbers.js";
import "../../../shared/usage-hourly-core.mjs";

const usageHourlyCore = globalThis.__vibeusageUsageHourlyCore;
if (!usageHourlyCore) throw new Error("usage hourly core not initialized");

export const createHourlyBuckets = usageHourlyCore.createHourlyBuckets;
export const addHourlyBucketTotals = usageHourlyCore.addHourlyBucketTotals;
export const resolveHalfHourSlot = usageHourlyCore.resolveHalfHourSlot;
export const formatHourKeyFromValue = usageHourlyCore.formatHourKeyFromValue;
export const buildHourlyResponse = usageHourlyCore.buildHourlyResponse;
export const resolveUsageHourlyRequestContext = usageHourlyCore.resolveUsageHourlyRequestContext;
export const resolveUsageHourlyRowSlot = usageHourlyCore.resolveUsageHourlyRowSlot;
