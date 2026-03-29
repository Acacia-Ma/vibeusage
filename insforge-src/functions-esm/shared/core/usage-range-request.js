import "../../../shared/usage-range-request-core.mjs";

const usageRangeRequestCore = globalThis.__vibeusageUsageRangeRequestCore;
if (!usageRangeRequestCore) {
  throw new Error("usage range request core not initialized");
}

export const resolveUsageRangeRequestContext =
  usageRangeRequestCore.resolveUsageRangeRequestContext;
