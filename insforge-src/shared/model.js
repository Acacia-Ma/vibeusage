"use strict";

require("./usage-model-core");

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

module.exports = {
  normalizeModel: usageModelCore.normalizeModel,
  normalizeUsageModel: usageModelCore.normalizeUsageModel,
  applyUsageModelFilter: usageModelCore.applyUsageModelFilter,
  getModelParam: usageModelCore.getModelParam,
};
