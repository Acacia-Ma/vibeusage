import "../../shared/pro-status-core.mjs";

const proStatusCore = globalThis.__vibeusageProStatusCore;
if (!proStatusCore) throw new Error("pro status core not initialized");

export const CUTOFF_UTC_ISO = proStatusCore.CUTOFF_UTC_ISO;
export const REGISTRATION_YEARS = proStatusCore.REGISTRATION_YEARS;
export const computeProStatus = proStatusCore.computeProStatus;
