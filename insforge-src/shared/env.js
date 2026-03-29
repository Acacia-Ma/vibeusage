"use strict";

require("./runtime-primitives-core");
require("./usage-model-core");
require("./env-core");

const envCore = globalThis.__vibeusageEnvCore;
if (!envCore) throw new Error("env core not initialized");

module.exports = {
  getBaseUrl: envCore.getBaseUrl,
  getRequestBaseUrl: envCore.getRequestBaseUrl,
  getServiceRoleKey: envCore.getServiceRoleKey,
  getAnonKey: envCore.getAnonKey,
  getJwtSecret: envCore.getJwtSecret,
  getUsageMaxDays: envCore.getUsageMaxDays,
  getSlowQueryThresholdMs: envCore.getSlowQueryThresholdMs,
  getPricingDefaults: envCore.getPricingDefaults,
};
