"use strict";

require("../model");
require("../canary");
require("../pagination");
require("../usage-hourly-query-core");

const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");

module.exports = {
  DEFAULT_HOURLY_USAGE_SELECT: usageHourlyQueryCore.DEFAULT_HOURLY_USAGE_SELECT,
  DETAILED_HOURLY_USAGE_SELECT: usageHourlyQueryCore.DETAILED_HOURLY_USAGE_SELECT,
  AGGREGATE_HOURLY_USAGE_SELECT: usageHourlyQueryCore.AGGREGATE_HOURLY_USAGE_SELECT,
  buildHourlyUsageQuery: usageHourlyQueryCore.buildHourlyUsageQuery,
  forEachHourlyUsagePage: usageHourlyQueryCore.forEachHourlyUsagePage,
};
