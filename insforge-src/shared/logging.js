"use strict";

require("./env");
require("./logging-core");

const loggingCore = globalThis.__vibeusageLoggingCore;
if (!loggingCore) throw new Error("logging core not initialized");

module.exports = {
  withRequestLogging: loggingCore.withRequestLogging,
  logSlowQuery: loggingCore.logSlowQuery,
  getSlowQueryThresholdMs: loggingCore.getSlowQueryThresholdMs,
};
