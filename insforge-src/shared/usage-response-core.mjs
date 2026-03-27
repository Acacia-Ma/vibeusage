import "./debug-core.mjs";
import "./http-core.mjs";

const CORE_KEY = "__vibeusageUsageResponseCore";
const debugCore = globalThis.__vibeusageDebugCore;
const httpCore = globalThis.__vibeusageHttpCore;

if (!debugCore) throw new Error("debug core not initialized");
if (!httpCore) throw new Error("http core not initialized");

function mergeUsageDebugPayload(
  body,
  { url, logger, durationMs, status, debugFields } = {},
) {
  if (!debugCore.isDebugEnabled(url)) return body;
  const resolvedBody = debugCore.withSlowQueryDebugPayload(body, { logger, durationMs, status });
  if (!debugFields || typeof debugFields !== "object" || Array.isArray(debugFields)) return resolvedBody;
  return {
    ...resolvedBody,
    debug: {
      ...(resolvedBody?.debug && typeof resolvedBody.debug === "object" ? resolvedBody.debug : {}),
      ...debugFields,
    },
  };
}

function resolveUsageResponseBody(body, { url, logger, durationMs, status } = {}) {
  return mergeUsageDebugPayload(body, { url, logger, durationMs, status });
}

function createUsageJsonResponder({ url, logger, extraHeaders } = {}) {
  return function respond(body, status = 200, durationMs = 0) {
    return httpCore.json(
      resolveUsageResponseBody(body, { url, logger, durationMs, status }),
      status,
      extraHeaders || null,
    );
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      createUsageJsonResponder,
      mergeUsageDebugPayload,
      resolveUsageResponseBody,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
