import "../../../shared/usage-model-core.mjs";
import "../../../shared/usage-filter-core.mjs";

const usageFilterCore = globalThis.__vibeusageUsageFilterCore;
if (!usageFilterCore) throw new Error("usage filter core not initialized");

export const shouldIncludeUsageRow = usageFilterCore.shouldIncludeUsageRow;
