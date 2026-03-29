"use strict";

require("../runtime-primitives-core");
require("../usage-metrics-core");

const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

module.exports = {
  getSourceEntry: usageMetricsCore.getSourceEntry,
  resolveDisplayName: usageMetricsCore.resolveDisplayName,
  buildPricingBucketKey: usageMetricsCore.buildPricingBucketKey,
  parsePricingBucketKey: usageMetricsCore.parsePricingBucketKey,
};
