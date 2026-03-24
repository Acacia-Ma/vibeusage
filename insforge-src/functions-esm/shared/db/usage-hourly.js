import "../canary.js";
import "../../../shared/usage-model-core.mjs";
import "../../../shared/usage-hourly-query-core.mjs";

const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");

export const buildHourlyUsageQuery = usageHourlyQueryCore.buildHourlyUsageQuery;
