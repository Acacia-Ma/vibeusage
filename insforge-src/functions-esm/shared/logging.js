import { getSlowQueryThresholdMs } from "./env.js";

function createRequestId() {
  if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorCodeFromStatus(status) {
  if (typeof status !== "number") return "UNKNOWN_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  if (status >= 400) return "CLIENT_ERROR";
  return null;
}

function getResponseStatus(response) {
  if (response && typeof response.status === "number") return response.status;
  return null;
}

function resolveFunctionName(functionName, request) {
  if (request && typeof request.url === "string") {
    try {
      const url = new URL(request.url);
      const match = url.pathname.match(/\/functions\/([^/?#]+)/);
      if (match && match[1]) return match[1];
    } catch (_error) {}
  }
  return functionName;
}

export function createLogger({ functionName }) {
  const requestId = createRequestId();
  const startMs = Date.now();
  let upstreamStatus = null;
  let upstreamLatencyMs = null;

  function recordUpstream(status, latencyMs) {
    upstreamStatus = typeof status === "number" ? status : null;
    upstreamLatencyMs = typeof latencyMs === "number" ? latencyMs : null;
  }

  async function fetchWithUpstream(url, init) {
    const upstreamStart = Date.now();
    try {
      const res = await fetch(url, init);
      recordUpstream(res.status, Date.now() - upstreamStart);
      return res;
    } catch (error) {
      recordUpstream(null, Date.now() - upstreamStart);
      throw error;
    }
  }

  function log({ stage, status, errorCode, ...extra }) {
    const payload = {
      ...(extra || {}),
      request_id: requestId,
      function: functionName,
      stage: stage || "response",
      status: typeof status === "number" ? status : null,
      latency_ms: Date.now() - startMs,
      error_code: errorCode ?? errorCodeFromStatus(status),
      upstream_status: upstreamStatus ?? null,
      upstream_latency_ms: upstreamLatencyMs ?? null,
    };
    console.log(JSON.stringify(payload));
  }

  return {
    requestId,
    log,
    fetch: fetchWithUpstream,
  };
}

export function withRequestLogging(functionName, handler) {
  return async function (request) {
    const resolvedName = resolveFunctionName(functionName, request);
    const logger = createLogger({ functionName: resolvedName });
    try {
      const response = await handler(request, logger);
      logger.log({ stage: "response", status: getResponseStatus(response) });
      return response;
    } catch (error) {
      logger.log({ stage: "exception", status: 500, errorCode: "UNHANDLED_EXCEPTION" });
      throw error;
    }
  };
}

export function logSlowQuery(logger, fields) {
  if (!logger || typeof logger.log !== "function") return;
  const durationMs = Number(fields?.duration_ms ?? fields?.durationMs);
  if (!Number.isFinite(durationMs)) return;
  const thresholdMs = getSlowQueryThresholdMs();
  if (durationMs < thresholdMs) return;
  logger.log({
    stage: "slow_query",
    status: 200,
    ...(fields || {}),
    duration_ms: Math.round(durationMs),
  });
}
