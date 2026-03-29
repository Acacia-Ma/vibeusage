import "../../../shared/usage-aggregate-request-core.mjs";

const usageAggregateRequestCore = globalThis.__vibeusageUsageAggregateRequestCore;
if (!usageAggregateRequestCore) {
  throw new Error("usage aggregate request core not initialized");
}

export const resolveAggregateUsageRequestContext =
  usageAggregateRequestCore.resolveAggregateUsageRequestContext;
