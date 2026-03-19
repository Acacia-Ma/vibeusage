import { getSlowQueryThresholdMs } from "./env.js";

export function isDebugEnabled(url) {
  if (!url) return false;
  if (typeof url === "string") {
    try {
      return new URL(url).searchParams.get("debug") === "1";
    } catch (_error) {
      return false;
    }
  }
  return url?.searchParams?.get("debug") === "1";
}

export function buildSlowQueryDebugPayload({ logger, durationMs, status } = {}) {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
  const thresholdMs = getSlowQueryThresholdMs();
  if (logger?.log) {
    logger.log({
      stage: "debug_payload",
      status: typeof status === "number" ? status : null,
      query_ms: safeDuration,
      slow_threshold_ms: thresholdMs,
      slow_query: safeDuration >= thresholdMs ? 1 : 0,
    });
  }
  return {
    request_id: logger?.requestId || "",
    status: typeof status === "number" ? status : null,
    query_ms: safeDuration,
    slow_threshold_ms: thresholdMs,
    slow_query: safeDuration >= thresholdMs,
  };
}

export function withSlowQueryDebugPayload(body, options) {
  if (!body || typeof body !== "object" || body.debug) return body;
  return {
    ...body,
    debug: buildSlowQueryDebugPayload(options),
  };
}
