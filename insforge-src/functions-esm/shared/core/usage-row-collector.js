import "../../../shared/usage-row-collector-core.mjs";

const usageRowCollectorCore = globalThis.__vibeusageUsageRowCollectorCore;
if (!usageRowCollectorCore) throw new Error("usage row collector core not initialized");

export const collectHourlyUsageRows = usageRowCollectorCore.collectHourlyUsageRows;
