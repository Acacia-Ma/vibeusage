"use strict";

require("./runtime-primitives-core");
require("./canary-core");

const CORE_KEY = "__vibeusageProjectUsageCore";
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
const canaryCore = globalThis.__vibeusageCanaryCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
if (!canaryCore) throw new Error("canary core not initialized");

const { toBigInt, toPositiveIntOrNull } = runtimePrimitivesCore;
const DEFAULT_PROJECT_USAGE_LIMIT = 3;
const MAX_PROJECT_USAGE_LIMIT = 10;

function normalizeProjectUsageLimit(raw) {
  const parsed = toPositiveIntOrNull(raw);
  if (parsed == null) return DEFAULT_PROJECT_USAGE_LIMIT;
  if (parsed < 1) return 1;
  if (parsed > MAX_PROJECT_USAGE_LIMIT) return MAX_PROJECT_USAGE_LIMIT;
  return parsed;
}

function normalizeProjectUsageAggregateValue(value) {
  if (value == null) return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return String(value);
}

function resolveProjectUsageBillableTotal(totalTokens, billableRaw) {
  if (billableRaw == null) return totalTokens;
  return normalizeProjectUsageAggregateValue(billableRaw);
}

function normalizeProjectUsageEntry({ projectKey, projectRef, totalTokens, billableTotalTokens } = {}) {
  if (!projectKey || !projectRef) return null;
  const normalizedTotal = normalizeProjectUsageAggregateValue(totalTokens);
  return {
    project_key: projectKey,
    project_ref: projectRef,
    total_tokens: normalizedTotal,
    billable_total_tokens: resolveProjectUsageBillableTotal(normalizedTotal, billableTotalTokens),
  };
}

function normalizeProjectUsageRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) =>
      normalizeProjectUsageEntry({
        projectKey: row?.project_key || null,
        projectRef: row?.project_ref || null,
        totalTokens: row?.sum_total_tokens,
        billableTotalTokens: row?.sum_billable_total_tokens,
      }),
    )
    .filter(Boolean);
}

function shouldFallbackProjectUsageAggregate(message) {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  if (normalized.includes("aggregate functions is not allowed")) return true;
  return normalized.includes("schema cache") && normalized.includes("relationship") && normalized.includes("'sum'");
}

function buildProjectUsageBaseQuery({ edgeClient, userId, source, select } = {}) {
  const from = edgeClient?.database?.from;
  if (typeof from !== "function") {
    throw new Error("edgeClient.database.from is required");
  }
  let query = from("vibeusage_project_usage_hourly").select(select).eq("user_id", userId);
  if (source) query = query.eq("source", source);
  if (!canaryCore.isCanaryTag(source)) query = query.neq("source", "canary");
  return query;
}

function buildProjectUsageAggregateQuery({ edgeClient, userId, source, limit } = {}) {
  return buildProjectUsageBaseQuery({
    edgeClient,
    userId,
    source,
    select:
      "project_key,project_ref,sum_total_tokens:sum(total_tokens),sum_billable_total_tokens:sum(billable_total_tokens)",
  })
    .order("sum_billable_total_tokens", { ascending: false })
    .order("sum_total_tokens", { ascending: false })
    .limit(limit);
}

function buildProjectUsageFallbackQuery({ edgeClient, userId, source } = {}) {
  return buildProjectUsageBaseQuery({
    edgeClient,
    userId,
    source,
    select: "project_key,project_ref,total_tokens,billable_total_tokens",
  });
}

function aggregateProjectUsageRows(rows, limit) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const projectKey = typeof row?.project_key === "string" ? row.project_key : null;
    const projectRef = typeof row?.project_ref === "string" ? row.project_ref : null;
    if (!projectKey || !projectRef) continue;
    const key = `${projectKey}::${projectRef}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { project_key: projectKey, project_ref: projectRef, total: 0n, billable: 0n };
      map.set(key, entry);
    }
    entry.total += toBigInt(row?.total_tokens);
    const billableRaw =
      row && Object.prototype.hasOwnProperty.call(row, "billable_total_tokens")
        ? row.billable_total_tokens
        : null;
    const billable = billableRaw == null ? row?.total_tokens : billableRaw;
    entry.billable += toBigInt(billable);
  }
  const entries = Array.from(map.values()).map((entry) => ({
    project_key: entry.project_key,
    project_ref: entry.project_ref,
    total_tokens: entry.total.toString(),
    billable_total_tokens: entry.billable.toString(),
  }));
  entries.sort((a, b) => {
    const aBillable = toBigInt(a.billable_total_tokens);
    const bBillable = toBigInt(b.billable_total_tokens);
    if (aBillable === bBillable) {
      const aTotal = toBigInt(a.total_tokens);
      const bTotal = toBigInt(b.total_tokens);
      if (aTotal === bTotal) return 0;
      return aTotal > bTotal ? -1 : 1;
    }
    return aBillable > bBillable ? -1 : 1;
  });
  if (!Number.isFinite(limit)) return entries;
  return entries.slice(0, Math.max(1, Math.floor(limit)));
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      DEFAULT_PROJECT_USAGE_LIMIT,
      MAX_PROJECT_USAGE_LIMIT,
      aggregateProjectUsageRows,
      buildProjectUsageAggregateQuery,
      buildProjectUsageFallbackQuery,
      normalizeProjectUsageAggregateValue,
      normalizeProjectUsageEntry,
      normalizeProjectUsageLimit,
      normalizeProjectUsageRows,
      resolveProjectUsageBillableTotal,
      shouldFallbackProjectUsageAggregate,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
