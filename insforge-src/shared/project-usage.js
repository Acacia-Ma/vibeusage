"use strict";

require("./project-usage-core");

const projectUsageCore = globalThis.__vibeusageProjectUsageCore;
if (!projectUsageCore) throw new Error("project usage core not initialized");

module.exports = {
  DEFAULT_PROJECT_USAGE_LIMIT: projectUsageCore.DEFAULT_PROJECT_USAGE_LIMIT,
  MAX_PROJECT_USAGE_LIMIT: projectUsageCore.MAX_PROJECT_USAGE_LIMIT,
  aggregateProjectUsageRows: projectUsageCore.aggregateProjectUsageRows,
  buildProjectUsageAggregateQuery: projectUsageCore.buildProjectUsageAggregateQuery,
  buildProjectUsageFallbackQuery: projectUsageCore.buildProjectUsageFallbackQuery,
  normalizeProjectUsageAggregateValue: projectUsageCore.normalizeProjectUsageAggregateValue,
  normalizeProjectUsageEntry: projectUsageCore.normalizeProjectUsageEntry,
  normalizeProjectUsageLimit: projectUsageCore.normalizeProjectUsageLimit,
  normalizeProjectUsageRows: projectUsageCore.normalizeProjectUsageRows,
  resolveProjectUsageBillableTotal: projectUsageCore.resolveProjectUsageBillableTotal,
  shouldFallbackProjectUsageAggregate: projectUsageCore.shouldFallbackProjectUsageAggregate,
};
