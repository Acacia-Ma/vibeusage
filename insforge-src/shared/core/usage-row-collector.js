"use strict";

require("../usage-row-collector-core");

const usageRowCollectorCore = globalThis.__vibeusageUsageRowCollectorCore;
if (!usageRowCollectorCore) throw new Error("usage row collector core not initialized");

module.exports = {
  collectHourlyUsageRows: usageRowCollectorCore.collectHourlyUsageRows,
};
