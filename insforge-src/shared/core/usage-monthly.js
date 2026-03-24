"use strict";

require("../date");
require("../numbers");
require("../model");
require("../usage-aggregate");
require("./usage-filter");
require("../usage-monthly-core");

const usageMonthlyCore = globalThis.__vibeusageUsageMonthlyCore;
if (!usageMonthlyCore) throw new Error("usage monthly core not initialized");

module.exports = {
  initMonthlyBuckets: usageMonthlyCore.initMonthlyBuckets,
  ingestMonthlyRow: usageMonthlyCore.ingestMonthlyRow,
};
