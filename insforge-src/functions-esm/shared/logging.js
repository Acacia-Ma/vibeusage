import "./env.js";
import "../../shared/logging-core.mjs";

const loggingCore = globalThis.__vibeusageLoggingCore;
if (!loggingCore) throw new Error("logging core not initialized");

export const createLogger = loggingCore.createLogger;
export const withRequestLogging = loggingCore.withRequestLogging;
export const logSlowQuery = loggingCore.logSlowQuery;
