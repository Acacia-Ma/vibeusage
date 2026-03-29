import "../../shared/runtime-primitives-core.mjs";

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

export const toBigInt = runtimePrimitivesCore.toBigInt;
export const toPositiveIntOrNull = runtimePrimitivesCore.toPositiveIntOrNull;
export const toPositiveInt = runtimePrimitivesCore.toPositiveInt;
