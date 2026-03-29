import "../../shared/canary-core.mjs";

const canaryCore = globalThis.__vibeusageCanaryCore;
if (!canaryCore) throw new Error("canary core not initialized");

export const isCanaryTag = canaryCore.isCanaryTag;
export const applyCanaryFilter = canaryCore.applyCanaryFilter;
