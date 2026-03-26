"use strict";

require("./env-core");
require("./debug-core");

const debugCore = globalThis.__vibeusageDebugCore;
if (!debugCore) throw new Error("debug core not initialized");

module.exports = {
  isDebugEnabled: debugCore.isDebugEnabled,
  buildSlowQueryDebugPayload: debugCore.buildSlowQueryDebugPayload,
  withSlowQueryDebugPayload: debugCore.withSlowQueryDebugPayload,
};
