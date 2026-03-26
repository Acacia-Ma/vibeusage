import "../../shared/env-core.mjs";
import "../../shared/debug-core.mjs";

const debugCore = globalThis.__vibeusageDebugCore;
if (!debugCore) throw new Error("debug core not initialized");

export const isDebugEnabled = debugCore.isDebugEnabled;
export const buildSlowQueryDebugPayload = debugCore.buildSlowQueryDebugPayload;
export const withSlowQueryDebugPayload = debugCore.withSlowQueryDebugPayload;
