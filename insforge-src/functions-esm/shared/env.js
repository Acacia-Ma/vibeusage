import "../../shared/runtime-primitives-core.mjs";
import "../../shared/usage-model-core.mjs";
import "../../shared/env-core.mjs";

const envCore = globalThis.__vibeusageEnvCore;
if (!envCore) throw new Error("env core not initialized");

export const getBaseUrl = envCore.getBaseUrl;
export const getRequestBaseUrl = envCore.getRequestBaseUrl;
export const getServiceRoleKey = envCore.getServiceRoleKey;
export const getAnonKey = envCore.getAnonKey;
export const getJwtSecret = envCore.getJwtSecret;
export const getUsageMaxDays = envCore.getUsageMaxDays;
export const getSlowQueryThresholdMs = envCore.getSlowQueryThresholdMs;
export const getPricingDefaults = envCore.getPricingDefaults;
