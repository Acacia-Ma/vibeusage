"use strict";

require("./runtime-primitives-core");
require("./usage-model-core");
require("./env-core");
require("./pricing-core");
require("./usage-metrics-core");

const CORE_KEY = "__vibeusageUsagePricingCore";
const DEFAULT_MODEL = "unknown";

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");
const pricingCore = globalThis.__vibeusagePricingCore;
if (!pricingCore) throw new Error("pricing core not initialized");
const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

const {
  applyModelIdentity,
  extractDateKey,
  normalizeUsageModel,
  normalizeUsageModelKey,
  resolveIdentityAtDate,
  resolveModelIdentity,
  resolveUsageTimelineContext,
} = usageModelCore;
const {
  addRowTotals,
  applyTotalsAndBillable,
  buildPricingBucketKey,
  createTotals,
  getSourceEntry,
  parsePricingBucketKey,
  resolveBillableTotals,
  resolveDisplayName,
} = usageMetricsCore;
const { resolvePricingProfile, computeUsageCost } = pricingCore;

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

  const sourceKey = runtimePrimitivesCore.normalizeSource(row?.source) || defaultSource;
  const { billable, hasStoredBillable } = resolveBillableTotals({ row, source: sourceKey });
  applyTotalsAndBillable({ totals: state.totals, row, billable, hasStoredBillable });
  const sourceEntry = getSourceEntry(state.sourcesMap, sourceKey);
  applyTotalsAndBillable({ totals: sourceEntry.totals, row, billable, hasStoredBillable });

  const normalizedModel = normalizeUsageModel(row?.model);
  if (normalizedModel && normalizedModel !== DEFAULT_MODEL) {
    state.distinctModels.add(normalizedModel);
  }

  let bucketKey = null;
  let dateKey = extractDateKey(row?.hour_start || row?.day) || effectiveDate || null;
  if (!state.hasModelParam && state.pricingBuckets instanceof Map) {
    const usageKey = normalizeUsageModelKey(normalizedModel) || state.defaultModel || DEFAULT_MODEL;
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
