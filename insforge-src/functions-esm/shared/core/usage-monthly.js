import "../date.js";
import "../numbers.js";
import "../usage-summary-support.js";
import "../../../shared/usage-monthly-core.mjs";

const usageMonthlyCore = globalThis.__vibeusageUsageMonthlyCore;
if (!usageMonthlyCore) throw new Error("usage monthly core not initialized");

export const initMonthlyBuckets = usageMonthlyCore.initMonthlyBuckets;
export const ingestMonthlyRow = usageMonthlyCore.ingestMonthlyRow;
