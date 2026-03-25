import "../../../shared/usage-aggregate-collector-core.mjs";

const usageAggregateCollectorCore = globalThis.__vibeusageUsageAggregateCollectorCore;
if (!usageAggregateCollectorCore) {
  throw new Error("usage aggregate collector core not initialized");
}

export const collectAggregateUsageRange = usageAggregateCollectorCore.collectAggregateUsageRange;
