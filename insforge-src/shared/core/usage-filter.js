"use strict";

require("../model");
require("../model-alias-timeline");
require("../usage-filter-core");

const usageFilterCore = globalThis.__vibeusageUsageFilterCore;
if (!usageFilterCore) throw new Error("usage filter core not initialized");

module.exports = {
  shouldIncludeUsageRow: usageFilterCore.shouldIncludeUsageRow,
};
