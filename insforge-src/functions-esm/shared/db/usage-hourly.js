import "../canary.js";
import "../../../shared/usage-model-core.mjs";
import "../../../shared/pagination-core.mjs";
import "../../../shared/usage-hourly-query-core.mjs";

const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");

export const buildHourlyUsageQuery = usageHourlyQueryCore.buildHourlyUsageQuery;
export const forEachHourlyUsagePage = usageHourlyQueryCore.forEachHourlyUsagePage;
export const DEFAULT_HOURLY_USAGE_SELECT = usageHourlyQueryCore.DEFAULT_HOURLY_USAGE_SELECT;
export const DETAILED_HOURLY_USAGE_SELECT = usageHourlyQueryCore.DETAILED_HOURLY_USAGE_SELECT;
export const AGGREGATE_HOURLY_USAGE_SELECT = usageHourlyQueryCore.AGGREGATE_HOURLY_USAGE_SELECT;
