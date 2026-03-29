"use strict";

require("./runtime-primitives-core");
require("./usage-metrics-core");

const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

module.exports = {
  resolveBillableTotals: usageMetricsCore.resolveBillableTotals,
  applyTotalsAndBillable: usageMetricsCore.applyTotalsAndBillable,
};
