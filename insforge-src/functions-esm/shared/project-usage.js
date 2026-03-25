import "../../shared/project-usage-core.mjs";

const projectUsageCore = globalThis.__vibeusageProjectUsageCore;
if (!projectUsageCore) throw new Error("project usage core not initialized");

export const DEFAULT_PROJECT_USAGE_LIMIT = projectUsageCore.DEFAULT_PROJECT_USAGE_LIMIT;
export const MAX_PROJECT_USAGE_LIMIT = projectUsageCore.MAX_PROJECT_USAGE_LIMIT;
export const aggregateProjectUsageRows = projectUsageCore.aggregateProjectUsageRows;
export const normalizeProjectUsageAggregateValue = projectUsageCore.normalizeProjectUsageAggregateValue;
export const normalizeProjectUsageEntry = projectUsageCore.normalizeProjectUsageEntry;
export const normalizeProjectUsageLimit = projectUsageCore.normalizeProjectUsageLimit;
export const normalizeProjectUsageRows = projectUsageCore.normalizeProjectUsageRows;
export const resolveProjectUsageBillableTotal = projectUsageCore.resolveProjectUsageBillableTotal;
export const shouldFallbackProjectUsageAggregate = projectUsageCore.shouldFallbackProjectUsageAggregate;
