"use strict";

require("../model");
require("../canary");
require("../usage-hourly-query-core");

const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");

module.exports = {
  buildHourlyUsageQuery: usageHourlyQueryCore.buildHourlyUsageQuery,
};
