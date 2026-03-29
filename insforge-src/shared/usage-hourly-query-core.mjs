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
const DEFAULT_HOURLY_USAGE_SELECT = "hour_start,source,model,total_tokens";
const DETAILED_HOURLY_USAGE_SELECT =
  "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens";
const AGGREGATE_HOURLY_USAGE_SELECT =
  "source,hour:hour_start,sum_total_tokens:sum(total_tokens),sum_input_tokens:sum(input_tokens),sum_cached_input_tokens:sum(cached_input_tokens),sum_output_tokens:sum(output_tokens),sum_reasoning_output_tokens:sum(reasoning_output_tokens),sum_billable_total_tokens:sum(billable_total_tokens),count_rows:count(),count_billable_total_tokens:count(billable_total_tokens)";

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
    .select(select || DEFAULT_HOURLY_USAGE_SELECT);

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
      DEFAULT_HOURLY_USAGE_SELECT,
      DETAILED_HOURLY_USAGE_SELECT,
      AGGREGATE_HOURLY_USAGE_SELECT,
      buildHourlyUsageQuery,
      forEachHourlyUsagePage,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
