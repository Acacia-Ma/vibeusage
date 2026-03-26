"use strict";

require("./usage-model-core");

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

module.exports = {
  normalizeUsageModelKey: usageModelCore.normalizeUsageModelKey,
  buildIdentityMap: usageModelCore.buildIdentityMap,
  applyModelIdentity: usageModelCore.applyModelIdentity,
  resolveModelIdentity: usageModelCore.resolveModelIdentity,
  resolveUsageModelsForCanonical: usageModelCore.resolveUsageModelsForCanonical,
  resolveUsageFilterContext: usageModelCore.resolveUsageFilterContext,
  resolveUsageTimelineContext: usageModelCore.resolveUsageTimelineContext,
  matchesCanonicalModelAtDate: usageModelCore.matchesCanonicalModelAtDate,
};
