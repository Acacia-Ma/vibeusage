"use strict";

require("../usage-aggregate-collector-core");

const usageAggregateCollectorCore = globalThis.__vibeusageUsageAggregateCollectorCore;
if (!usageAggregateCollectorCore) {
  throw new Error("usage aggregate collector core not initialized");
}

module.exports = {
  collectAggregateUsageRange: usageAggregateCollectorCore.collectAggregateUsageRange,
};
