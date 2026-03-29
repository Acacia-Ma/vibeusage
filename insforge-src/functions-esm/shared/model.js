import "../../shared/usage-model-core.mjs";

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

export const normalizeModel = usageModelCore.normalizeModel;
export const normalizeUsageModel = usageModelCore.normalizeUsageModel;
export const applyUsageModelFilter = usageModelCore.applyUsageModelFilter;
export const getModelParam = usageModelCore.getModelParam;
