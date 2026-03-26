"use strict";

const CORE_KEY = "__vibeusageCanaryCore";

function isCanaryTag(value) {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "canary";
}

function applyCanaryFilter(query, { source, model } = {}) {
  if (!query || typeof query.neq !== "function") return query;
  if (isCanaryTag(source) || isCanaryTag(model)) return query;
  return query.neq("source", "canary").neq("model", "canary");
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      applyCanaryFilter,
      isCanaryTag,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
