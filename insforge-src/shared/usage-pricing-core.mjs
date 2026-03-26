"use strict";

import "./runtime-primitives-core.mjs";
import "./usage-model-core.mjs";
import "./usage-row-core.mjs";
import "./date-core.mjs";
import "./env-core.mjs";
import "./pricing-core.mjs";
import "./usage-metrics-core.mjs";

const CORE_KEY = "__vibeusageUsagePricingCore";
const DEFAULT_MODEL = "unknown";

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");
const usageRowCore = globalThis.__vibeusageUsageRowCore;
if (!usageRowCore) throw new Error("usage row core not initialized");
const pricingCore = globalThis.__vibeusagePricingCore;
if (!pricingCore) throw new Error("pricing core not initialized");
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");

const {
  applyModelIdentity,
  resolveIdentityAtDate,
  resolveModelIdentity,
  resolveUsageTimelineContext,
} = usageModelCore;
const {
  addRowTotals,
  applyTotalsAndBillable,
  buildPricingBucketKey,
  buildUsageTotalsPayload,
  createTotals,
  getSourceEntry,
  parsePricingBucketKey,
  resolveDisplayName,
} = usageMetricsCore;
const { resolvePricingProfile, computeUsageCost, formatUsdFromMicros } = pricingCore;
const { formatLocalDateKey, listDateStrings } = dateCore;
const { resolveHourlyUsageRowState } = usageRowCore;

function createAggregateUsageState({
  hasModelParam = false,
  defaultModel = DEFAULT_MODEL,
} = {}) {
  return {
    totals: createTotals(),
    sourcesMap: new Map(),
    distinctModels: new Set(),
    distinctUsageModels: new Set(),
    pricingBuckets: hasModelParam ? null : new Map(),
    hasModelParam: Boolean(hasModelParam),
    defaultModel,
  };
}

function accumulateAggregateUsageRow({
  state,
  row,
  effectiveDate,
  defaultSource = "codex",
} = {}) {
  if (!state || !row) {
    return {
      billable: 0n,
      hasStoredBillable: false,
      normalizedModel: null,
      sourceKey: defaultSource,
    };
  }

  const resolvedRow = resolveHourlyUsageRowState({
    row,
    effectiveDate,
    defaultSource,
    defaultModel: state.defaultModel || DEFAULT_MODEL,
    useDefaultSourceForBilling: true,
  });
  if (!resolvedRow) {
    return {
      billable: 0n,
      hasStoredBillable: false,
      normalizedModel: null,
      sourceKey: defaultSource,
    };
  }

  const { billable, dateKey, hasStoredBillable, normalizedModel, sourceKey, usageKey } = resolvedRow;
  applyTotalsAndBillable({ totals: state.totals, row, billable, hasStoredBillable });
  const sourceEntry = getSourceEntry(state.sourcesMap, sourceKey);
  applyTotalsAndBillable({ totals: sourceEntry.totals, row, billable, hasStoredBillable });

  if (normalizedModel && normalizedModel !== DEFAULT_MODEL) {
    state.distinctModels.add(normalizedModel);
  }

  let bucketKey = null;
  if (!state.hasModelParam && state.pricingBuckets instanceof Map) {
    bucketKey = buildPricingBucketKey(sourceKey, usageKey, dateKey);
    const bucket = state.pricingBuckets.get(bucketKey) || createTotals();
    addRowTotals(bucket, row);
    state.pricingBuckets.set(bucketKey, bucket);
    state.distinctUsageModels.add(usageKey);
  }

  return {
    billable,
    bucketKey,
    dateKey,
    hasStoredBillable,
    normalizedModel,
    sourceKey,
  };
}

function createRollingUsageState() {
  return {
    totals: createTotals(),
    activeByDay: new Map(),
  };
}

function accumulateRollingUsageRow({
  state,
  row,
  tzContext,
  defaultSource = "codex",
} = {}) {
  if (!state || !row) {
    return {
      billable: 0n,
      dayKey: null,
      hasStoredBillable: false,
      sourceKey: defaultSource,
    };
  }

  const resolvedRow = resolveHourlyUsageRowState({
    row,
    defaultSource,
    useDefaultSourceForBilling: true,
  });
  if (!resolvedRow) {
    return {
      billable: 0n,
      dayKey: null,
      hasStoredBillable: false,
      sourceKey: defaultSource,
    };
  }

  const { billable, date, hasStoredBillable, sourceKey } = resolvedRow;
  applyTotalsAndBillable({ totals: state.totals, row, billable, hasStoredBillable });

  let dayKey = null;
  dayKey = formatLocalDateKey(date, tzContext);

  if (dayKey) {
    const billableTokens = hasStoredBillable ? runtimePrimitivesCore.toBigInt(row?.billable_total_tokens) : billable;
    if (billableTokens > 0n) {
      const prev = state.activeByDay.get(dayKey) || 0n;
      state.activeByDay.set(dayKey, prev + billableTokens);
    }
  }

  return {
    billable,
    dayKey,
    hasStoredBillable,
    sourceKey,
  };
}

function buildRollingUsagePayload({
  state,
  fromDay,
  toDay,
} = {}) {
  const windowDays = listDateStrings(fromDay, toDay).length;
  const activeDays =
    state?.activeByDay instanceof Map
      ? Array.from(state.activeByDay.values()).filter((value) => value > 0n).length
      : 0;
  const billableTotalTokens = runtimePrimitivesCore.toBigInt(state?.totals?.billable_total_tokens);
  const avgPerActiveDay = activeDays > 0 ? billableTotalTokens / BigInt(activeDays) : 0n;
  const avgPerDay = windowDays > 0 ? billableTotalTokens / BigInt(windowDays) : 0n;

  return {
    from: fromDay,
    to: toDay,
    window_days: windowDays,
    totals: { billable_total_tokens: billableTotalTokens.toString() },
    active_days: activeDays,
    avg_per_active_day: avgPerActiveDay.toString(),
    avg_per_day: avgPerDay.toString(),
  };
}

function buildAggregateUsagePayload({
  totals,
  pricingSummary,
  hasModelParam = false,
} = {}) {
  const resolvedTotals = totals || createTotals();
  const impliedModelId = pricingSummary?.impliedModelId || null;
  return {
    selection: {
      model_id: hasModelParam ? impliedModelId : null,
      model:
        hasModelParam && impliedModelId
          ? pricingSummary?.impliedModelDisplay || impliedModelId
          : null,
    },
    summary: {
      totals: buildUsageTotalsPayload(resolvedTotals, {
        total_cost_usd: formatUsdFromMicros(pricingSummary?.totalCostMicros || 0n),
      }),
      pricing: pricingCore.buildPricingMetadata({
        profile: pricingSummary?.overallCost?.profile || pricingCore.getDefaultPricingProfile(),
        pricingMode:
          pricingSummary?.summaryPricingMode || pricingSummary?.overallCost?.pricing_mode || "add",
      }),
    },
  };
}

async function resolveAggregateUsagePayload({
  edgeClient,
  canonicalModel,
  effectiveDate,
  state,
  hasModelParam = false,
  defaultModel = DEFAULT_MODEL,
} = {}) {
  const aggregateState =
    state ||
    createAggregateUsageState({
      hasModelParam,
      defaultModel,
    });
  const pricingSummary = await resolveAggregateUsagePricing({
    edgeClient,
    canonicalModel,
    distinctModels: aggregateState.distinctModels,
    distinctUsageModels: aggregateState.distinctUsageModels,
    pricingBuckets: aggregateState.pricingBuckets,
    effectiveDate,
    sourcesMap: aggregateState.sourcesMap,
    totals: aggregateState.totals,
    defaultModel,
  });
  const aggregatePayload = buildAggregateUsagePayload({
    totals: aggregateState.totals,
    pricingSummary,
    hasModelParam,
  });
  return {
    pricingSummary,
    aggregatePayload,
  };
}

function createModelBreakdownState() {
  return {
    sourcesMap: new Map(),
  };
}

function getModelBreakdownSourceEntry(state, source) {
  if (!state?.sourcesMap) return null;
  const entry = getSourceEntry(state.sourcesMap, source);
  if (!(entry.models instanceof Map)) {
    entry.models = new Map();
  }
  return entry;
}

function getModelBreakdownCanonicalEntry(sourceEntry, identity, defaultModel = DEFAULT_MODEL) {
  if (!sourceEntry) return null;
  const models = sourceEntry.models instanceof Map ? sourceEntry.models : new Map();
  sourceEntry.models = models;
  const key = identity?.model_id || defaultModel;
  if (models.has(key)) return models.get(key);
  const entry = {
    model_id: key,
    model: identity?.model || key,
    totals: createTotals(),
  };
  models.set(key, entry);
  return entry;
}

function accumulateModelBreakdownRow({
  state,
  row,
  identity,
  defaultModel = DEFAULT_MODEL,
} = {}) {
  if (!state || !row) return { sourceEntry: null, modelEntry: null };
  const sourceEntry = getModelBreakdownSourceEntry(state, row.source);
  addRowTotals(sourceEntry?.totals, row);
  const modelEntry = getModelBreakdownCanonicalEntry(sourceEntry, identity, defaultModel);
  addRowTotals(modelEntry?.totals, row);
  return { sourceEntry, modelEntry };
}

function addModelBreakdownCostMicros(entry, costMicros) {
  if (!entry) return;
  entry.cost_micros = runtimePrimitivesCore.toBigInt(entry.cost_micros) + runtimePrimitivesCore.toBigInt(costMicros);
}

function attributeModelBreakdownBucketCost({
  state,
  source,
  identity,
  costMicros,
  defaultModel = DEFAULT_MODEL,
} = {}) {
  if (!source) return { sourceEntry: null, modelEntry: null };
  const sourceEntry = getModelBreakdownSourceEntry(state, source);
  addModelBreakdownCostMicros(sourceEntry, costMicros);
  const modelEntry = getModelBreakdownCanonicalEntry(sourceEntry, identity, defaultModel);
  addModelBreakdownCostMicros(modelEntry, costMicros);
  return { sourceEntry, modelEntry };
}

function resolveModelBreakdownCostMicros(entry, pricingProfile) {
  if (!entry) return 0n;
  if (typeof entry.cost_micros === "bigint") return entry.cost_micros;
  return computeUsageCost(entry.totals, pricingProfile).cost_micros;
}

function formatModelBreakdownEntry(entry, pricingProfile) {
  const totals = entry?.totals || createTotals();
  const costMicros = resolveModelBreakdownCostMicros(entry, pricingProfile);
  const { cost_micros: _ignored, ...rest } = entry || {};
  return {
    ...rest,
    totals: buildUsageTotalsPayload(totals, {
      total_cost_usd: formatUsdFromMicros(costMicros),
    }),
  };
}

function compareModelBreakdownEntries(a, b) {
  const aSort = runtimePrimitivesCore.toBigInt(a?.totals?.billable_total_tokens ?? a?.totals?.total_tokens);
  const bSort = runtimePrimitivesCore.toBigInt(b?.totals?.billable_total_tokens ?? b?.totals?.total_tokens);
  if (aSort === bSort) return String(a?.model || "").localeCompare(String(b?.model || ""));
  return aSort > bSort ? -1 : 1;
}

function buildModelBreakdownSources({ state, pricingProfile } = {}) {
  if (!(state?.sourcesMap instanceof Map)) return [];
  return Array.from(state.sourcesMap.values())
    .map((entry) => {
      const models = Array.from(entry.models?.values?.() || [])
        .map((modelEntry) => formatModelBreakdownEntry(modelEntry, pricingProfile))
        .sort(compareModelBreakdownEntries);
      const totals = formatModelBreakdownEntry(entry, pricingProfile).totals;
      return {
        source: entry.source,
        totals,
        models,
      };
    })
    .sort((a, b) => a.source.localeCompare(b.source));
}

async function resolveBucketedUsagePricing({
  edgeClient,
  pricingBuckets,
  usageModels,
  effectiveDate,
  defaultModel = DEFAULT_MODEL,
  onBucketCost,
} = {}) {
  const totalCostMicros = 0n;
  const pricingModes = new Set();
  const canonicalModels = new Set();
  const usageModelList = Array.isArray(usageModels) ? usageModels.filter(Boolean) : [];

  if (!(pricingBuckets instanceof Map) || pricingBuckets.size === 0) {
    return { totalCostMicros, pricingModes, canonicalModels };
  }

  const timelineContext = await resolveUsageTimelineContext({
    edgeClient,
    usageModels: usageModelList,
    effectiveDate,
  });
  const timeline = timelineContext.aliasTimeline;
  const profileCache = new Map();
  let aggregatedCostMicros = 0n;

  const getProfile = async (modelId, dateKey) => {
    const key = buildPricingBucketKey("profile", modelId || "", dateKey || "");
    if (profileCache.has(key)) return profileCache.get(key);
    const profile = await resolvePricingProfile({
      edgeClient,
      model: modelId,
      effectiveDate: dateKey,
    });
    profileCache.set(key, profile);
    return profile;
  };

  for (const [bucketKey, bucketValue] of pricingBuckets.entries()) {
    const bucket =
      bucketValue && typeof bucketValue === "object" && bucketValue.totals ? bucketValue : null;
    const bucketTotals = bucket?.totals || bucketValue;
    const { usageKey, dateKey } = parsePricingBucketKey(bucketKey, effectiveDate);
    const identity = resolveIdentityAtDate({ usageKey, dateKey, timeline });
    if (identity.model_id && identity.model_id !== defaultModel) {
      canonicalModels.add(identity.model_id);
    }
    const profile = await getProfile(identity.model_id, dateKey);
    const cost = computeUsageCost(bucketTotals, profile);
    aggregatedCostMicros += cost.cost_micros;
    pricingModes.add(cost.pricing_mode);
    if (typeof onBucketCost === "function") {
      onBucketCost({ bucketKey, bucket, bucketTotals, identity, profile, cost, usageKey, dateKey });
    }
  }

  return {
    totalCostMicros: aggregatedCostMicros,
    pricingModes,
    canonicalModels,
  };
}

function accumulateSourceCostMicros({ sourcesMap, pricingProfile } = {}) {
  let totalCostMicros = 0n;
  const pricingModes = new Set();
  if (!(sourcesMap instanceof Map)) return { totalCostMicros, pricingModes };

  for (const entry of sourcesMap.values()) {
    if (!entry?.totals) continue;
    const sourceCost = computeUsageCost(entry.totals, pricingProfile);
    totalCostMicros += sourceCost.cost_micros;
    pricingModes.add(sourceCost.pricing_mode);
  }

  return { totalCostMicros, pricingModes };
}

function resolveImpliedModelId({ canonicalModel, canonicalModels } = {}) {
  if (canonicalModel) return canonicalModel;
  if (canonicalModels instanceof Set && canonicalModels.size === 1) {
    return Array.from(canonicalModels)[0] || null;
  }
  return null;
}

function resolveSummaryPricingMode({ pricingModes, overallPricingMode } = {}) {
  if (!(pricingModes instanceof Set) || pricingModes.size === 0) {
    return overallPricingMode;
  }
  if (pricingModes.size === 1) return Array.from(pricingModes)[0];
  return "mixed";
}

async function resolveAggregateUsagePricing({
  edgeClient,
  canonicalModel,
  distinctModels,
  distinctUsageModels,
  pricingBuckets,
  effectiveDate,
  sourcesMap,
  totals,
  defaultModel = DEFAULT_MODEL,
} = {}) {
  const distinctModelList =
    distinctModels instanceof Set
      ? Array.from(distinctModels.values())
      : Array.isArray(distinctModels)
        ? distinctModels.filter(Boolean)
        : [];
  const identityMap = await resolveModelIdentity({
    edgeClient,
    usageModels: distinctModelList,
    effectiveDate,
  });

  let canonicalModels = new Set();
  for (const modelValue of distinctModelList) {
    const identity = applyModelIdentity({ rawModel: modelValue, identityMap });
    if (identity.model_id && identity.model_id !== defaultModel) {
      canonicalModels.add(identity.model_id);
    }
  }

  let totalCostMicros = 0n;
  const pricingModes = new Set();
  const usageModelList =
    distinctUsageModels instanceof Set
      ? Array.from(distinctUsageModels.values())
      : Array.isArray(distinctUsageModels)
        ? distinctUsageModels.filter(Boolean)
        : [];
  if (pricingBuckets instanceof Map && pricingBuckets.size > 0 && usageModelList.length > 0) {
    const bucketedPricing = await resolveBucketedUsagePricing({
      edgeClient,
      pricingBuckets,
      usageModels: usageModelList,
      effectiveDate,
      defaultModel,
    });
    totalCostMicros += bucketedPricing.totalCostMicros;
    canonicalModels = bucketedPricing.canonicalModels;
    for (const mode of bucketedPricing.pricingModes.values()) {
      pricingModes.add(mode);
    }
  }

  const impliedModelId = resolveImpliedModelId({ canonicalModel, canonicalModels });
  const impliedModelDisplay = resolveDisplayName(identityMap, impliedModelId);
  const pricingProfile = await resolvePricingProfile({
    edgeClient,
    model: impliedModelId,
    effectiveDate,
  });

  if (pricingModes.size === 0) {
    const sourceCosts = accumulateSourceCostMicros({ sourcesMap, pricingProfile });
    totalCostMicros += sourceCosts.totalCostMicros;
    for (const mode of sourceCosts.pricingModes.values()) {
      pricingModes.add(mode);
    }
  }

  const overallCost = computeUsageCost(totals, pricingProfile);
  const summaryPricingMode = resolveSummaryPricingMode({
    pricingModes,
    overallPricingMode: overallCost.pricing_mode,
  });

  return {
    canonicalModels,
    identityMap,
    impliedModelId,
    impliedModelDisplay,
    overallCost,
    pricingProfile,
    pricingModes,
    summaryPricingMode,
    totalCostMicros,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      createAggregateUsageState,
      accumulateAggregateUsageRow,
      createRollingUsageState,
      accumulateRollingUsageRow,
      buildRollingUsagePayload,
      buildAggregateUsagePayload,
      resolveAggregateUsagePayload,
      createModelBreakdownState,
      accumulateModelBreakdownRow,
      attributeModelBreakdownBucketCost,
      buildModelBreakdownSources,
      resolveBucketedUsagePricing,
      accumulateSourceCostMicros,
      resolveImpliedModelId,
      resolveSummaryPricingMode,
      resolveAggregateUsagePricing,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
