import "../../shared/runtime-primitives-core.mjs";

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

export const MAX_SOURCE_LENGTH = runtimePrimitivesCore.MAX_SOURCE_LENGTH;
export const normalizeSource = runtimePrimitivesCore.normalizeSource;
export const getSourceParam = runtimePrimitivesCore.getSourceParam;
