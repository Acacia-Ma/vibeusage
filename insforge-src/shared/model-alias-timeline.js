"use strict";

require("./usage-model-core");

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

module.exports = {
  extractDateKey: usageModelCore.extractDateKey,
  resolveIdentityAtDate: usageModelCore.resolveIdentityAtDate,
  buildAliasTimeline: usageModelCore.buildAliasTimeline,
  fetchAliasRows: usageModelCore.fetchAliasRows,
};
