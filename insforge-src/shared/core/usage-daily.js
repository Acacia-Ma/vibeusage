"use strict";

require("../date");
require("../numbers");
require("../usage-daily-core");

const usageDailyCore = globalThis.__vibeusageUsageDailyCore;
if (!usageDailyCore) throw new Error("usage daily core not initialized");

module.exports = {
  initDailyBuckets: usageDailyCore.initDailyBuckets,
  applyDailyBucket: usageDailyCore.applyDailyBucket,
};
