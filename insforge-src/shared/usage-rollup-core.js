"use strict";

const CORE_KEY = "__vibeusageUsageRollupCore";
const canaryCore = globalThis.__vibeusageCanaryCore;
if (!canaryCore) throw new Error("canary core not initialized");
const paginationCore = globalThis.__vibeusagePaginationCore;
if (!paginationCore) throw new Error("pagination core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

const { applyCanaryFilter } = canaryCore;
const { forEachPage } = paginationCore;
const { createTotals, addRowTotals } = usageMetricsCore;

async function fetchRollupRows({ edgeClient, userId, fromDay, toDay, source, model }) {
  const rows = [];
  const { error } = await forEachPage({
    createQuery: () => {
      let query = edgeClient.database
        .from("vibeusage_tracker_daily_rollup")
        .select(
          "day,source,model,total_tokens,billable_total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
        )
        .eq("user_id", userId)
        .gte("day", fromDay)
        .lte("day", toDay);
      if (source) query = query.eq("source", source);
      if (model) query = query.eq("model", model);
      query = applyCanaryFilter(query, { source, model });
      return query
        .order("day", { ascending: true })
        .order("source", { ascending: true })
        .order("model", { ascending: true });
    },
    onPage: (pageRows) => {
      if (!Array.isArray(pageRows) || pageRows.length === 0) return;
      rows.push(...pageRows);
    },
  });
  if (error) return { ok: false, error };
  return { ok: true, rows };
}

function sumRollupRows(rows) {
  const totals = createTotals();
  for (const row of Array.isArray(rows) ? rows : []) {
    addRowTotals(totals, row);
  }
  return totals;
}

function isRollupEnabled() {
  const envCore = globalThis.__vibeusageEnvCore;
  const raw = envCore.readEnvValue?.("VIBEUSAGE_ROLLUP_ENABLED");
  if (raw == null) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      fetchRollupRows,
      sumRollupRows,
      isRollupEnabled,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
