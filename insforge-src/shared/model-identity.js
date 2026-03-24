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
  matchesCanonicalModelAtDate: usageModelCore.matchesCanonicalModelAtDate,
};
