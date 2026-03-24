import { applyCanaryFilter } from "./canary.js";
import "../../shared/usage-model-core.mjs";
import "../../shared/usage-metrics-core.mjs";

const DEFAULT_MODEL = "unknown";
const MAX_PAGE_SIZE = 1000;

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

export const normalizeModel = usageModelCore.normalizeModel;
export const normalizeUsageModel = usageModelCore.normalizeUsageModel;
export const applyUsageModelFilter = usageModelCore.applyUsageModelFilter;
export const getModelParam = usageModelCore.getModelParam;
export const normalizeUsageModelKey = usageModelCore.normalizeUsageModelKey;
export const applyModelIdentity = usageModelCore.applyModelIdentity;
export const resolveModelIdentity = usageModelCore.resolveModelIdentity;
export const resolveUsageModelsForCanonical = usageModelCore.resolveUsageModelsForCanonical;
export const extractDateKey = usageModelCore.extractDateKey;
export const resolveIdentityAtDate = usageModelCore.resolveIdentityAtDate;
export const buildAliasTimeline = usageModelCore.buildAliasTimeline;
export const fetchAliasRows = usageModelCore.fetchAliasRows;
export const createTotals = usageMetricsCore.createTotals;
export const addRowTotals = usageMetricsCore.addRowTotals;
export const resolveBillableTotals = usageMetricsCore.resolveBillableTotals;
export const applyTotalsAndBillable = usageMetricsCore.applyTotalsAndBillable;
export const getSourceEntry = usageMetricsCore.getSourceEntry;
export const resolveDisplayName = usageMetricsCore.resolveDisplayName;
export const buildPricingBucketKey = usageMetricsCore.buildPricingBucketKey;
export const parsePricingBucketKey = usageMetricsCore.parsePricingBucketKey;

export async function forEachPage({ createQuery, pageSize, onPage }) {
  if (typeof createQuery !== "function") throw new Error("createQuery must be a function");
  if (typeof onPage !== "function") throw new Error("onPage must be a function");
  const size = normalizePageSize(pageSize);
  let offset = 0;
  while (true) {
    const query = createQuery();
    if (!query || typeof query.range !== "function") {
      const { data, error } = await query;
      if (error) return { error };
      const rows = Array.isArray(data) ? data : [];
      if (rows.length) await onPage(rows);
      return { error: null };
    }
    const { data, error } = await query.range(offset, offset + size - 1);
    if (error) return { error };
    const rows = Array.isArray(data) ? data : [];
    if (rows.length) await onPage(rows);
    if (rows.length < size) break;
    offset += size;
  }
  return { error: null };
}

function normalizePageSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return MAX_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(size));
}

export async function fetchRollupRows({ edgeClient, userId, fromDay, toDay, source, model }) {
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
      if (Array.isArray(pageRows) && pageRows.length > 0) rows.push(...pageRows);
    },
  });
  if (error) return { ok: false, error };
  return { ok: true, rows };
}

export function isRollupEnabled() {
  return false;
}
