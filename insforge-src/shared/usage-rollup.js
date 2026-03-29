"use strict";

require("./canary-core");
require("./pagination-core");
require("./runtime-primitives-core");
require("./usage-metrics-core");
require("./usage-rollup-core");

const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");
const usageRollupCore = globalThis.__vibeusageUsageRollupCore;
if (!usageRollupCore) throw new Error("usage rollup core not initialized");

const { createTotals, addRowTotals } = usageMetricsCore;

module.exports = {
  createTotals,
  addRowTotals,
  fetchRollupRows: usageRollupCore.fetchRollupRows,
  sumRollupRows: usageRollupCore.sumRollupRows,
  isRollupEnabled: usageRollupCore.isRollupEnabled,
};
