"use strict";

const CORE_KEY = "__vibeusageUsageFilterCore";
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");

const { normalizeUsageModel, extractDateKey, resolveIdentityAtDate } = usageModelCore;

function shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to }) {
  if (!hasModelFilter) return true;
  const rawModel = normalizeUsageModel(row?.model);
  const dateKey = extractDateKey(row?.hour_start || row?.day) || to;
  const identity = resolveIdentityAtDate({ rawModel, dateKey, timeline: aliasTimeline });
  const filterIdentity = resolveIdentityAtDate({
    rawModel: canonicalModel,
    usageKey: canonicalModel,
    dateKey,
    timeline: aliasTimeline,
  });
  return identity.model_id === filterIdentity.model_id;
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
