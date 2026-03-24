"use strict";

const CORE_KEY = "__vibeusageUsageFilterCore";
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

const { extractDateKey, matchesCanonicalModelAtDate } = usageModelCore;

function shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to }) {
  if (!hasModelFilter) return true;
  const dateKey = extractDateKey(row?.hour_start || row?.day) || to;
  return matchesCanonicalModelAtDate({
    rawModel: row?.model,
    canonicalModel,
    dateKey,
    timeline: aliasTimeline,
  });
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      shouldIncludeUsageRow,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
