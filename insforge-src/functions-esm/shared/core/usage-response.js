import "../../../shared/usage-response-core.mjs";

const usageResponseCore = globalThis.__vibeusageUsageResponseCore;
if (!usageResponseCore) throw new Error("usage response core not initialized");

export const createUsageJsonResponder = usageResponseCore.createUsageJsonResponder;
export const mergeUsageDebugPayload = usageResponseCore.mergeUsageDebugPayload;
export const resolveUsageResponseBody = usageResponseCore.resolveUsageResponseBody;
