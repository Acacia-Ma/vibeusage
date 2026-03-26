"use strict";

require("../usage-response-core");

const usageResponseCore = globalThis.__vibeusageUsageResponseCore;
if (!usageResponseCore) throw new Error("usage response core not initialized");

module.exports = {
  createUsageJsonResponder: usageResponseCore.createUsageJsonResponder,
  resolveUsageResponseBody: usageResponseCore.resolveUsageResponseBody,
};
