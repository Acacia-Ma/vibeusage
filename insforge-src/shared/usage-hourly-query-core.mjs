"use strict";

const CORE_KEY = "__vibeusageUsageHourlyQueryCore";
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const canaryCore = globalThis.__vibeusageCanaryCore;
if (!canaryCore) throw new Error("canary core not initialized");

const { applyUsageModelFilter } = usageModelCore;
const { applyCanaryFilter } = canaryCore;

function buildHourlyUsageQuery({
  edgeClient,
  userId,
  source,
  usageModels,
  canonicalModel,
  startIso,
  endIso,
  select,
} = {}) {
  if (!edgeClient?.database?.from) {
    throw new Error("edgeClient is required");
  }
  let query = edgeClient.database
    .from("vibeusage_tracker_hourly")
    .select(select || "hour_start,source,model,total_tokens");

  query = query.eq("user_id", userId);
  if (source) query = query.eq("source", source);
  if (Array.isArray(usageModels) && usageModels.length > 0) {
    query = applyUsageModelFilter(query, usageModels);
  }
  query = applyCanaryFilter(query, { source, model: canonicalModel });

  if (startIso) query = query.gte("hour_start", startIso);
  if (endIso) query = query.lt("hour_start", endIso);

  return query
    .order("hour_start", { ascending: true })
    .order("device_id", { ascending: true })
    .order("source", { ascending: true })
    .order("model", { ascending: true });
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      buildHourlyUsageQuery,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
