"use strict";

const CORE_KEY = "__vibeusageUsageHourlyQueryCore";
const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const canaryCore = globalThis.__vibeusageCanaryCore;
if (!canaryCore) throw new Error("canary core not initialized");
const paginationCore = globalThis.__vibeusagePaginationCore;
if (!paginationCore) throw new Error("pagination core not initialized");

const { applyUsageModelFilter } = usageModelCore;
const { applyCanaryFilter } = canaryCore;
const { forEachPage } = paginationCore;

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

async function forEachHourlyUsagePage({
  edgeClient,
  userId,
  source,
  usageModels,
  canonicalModel,
  startIso,
  endIso,
  select,
  pageSize,
  onPage,
} = {}) {
  if (typeof onPage !== "function") {
    throw new Error("onPage must be a function");
  }

  let rowCount = 0;
  const { error } = await forEachPage({
    pageSize,
    createQuery: () =>
      buildHourlyUsageQuery({
        edgeClient,
        userId,
        source,
        usageModels,
        canonicalModel,
        startIso,
        endIso,
        select,
      }),
    onPage: async (rows) => {
      const pageRows = Array.isArray(rows) ? rows : [];
      rowCount += pageRows.length;
      await onPage(pageRows);
    },
  });

  return { error, rowCount };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      buildHourlyUsageQuery,
      forEachHourlyUsagePage,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
