"use strict";

require("../usage-range-request-core");

const usageRangeRequestCore = globalThis.__vibeusageUsageRangeRequestCore;
if (!usageRangeRequestCore) {
  throw new Error("usage range request core not initialized");
}

module.exports = {
  resolveUsageRangeRequestContext: usageRangeRequestCore.resolveUsageRangeRequestContext,
};
