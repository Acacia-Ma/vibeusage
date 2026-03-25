"use strict";

require("../usage-aggregate-request-core");

const usageAggregateRequestCore = globalThis.__vibeusageUsageAggregateRequestCore;
if (!usageAggregateRequestCore) {
  throw new Error("usage aggregate request core not initialized");
}

module.exports = {
  resolveAggregateUsageRequestContext:
    usageAggregateRequestCore.resolveAggregateUsageRequestContext,
};
