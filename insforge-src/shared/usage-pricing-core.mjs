"use strict";

import "./runtime-primitives-core.mjs";
import "./usage-model-core.mjs";
import "./env-core.mjs";
import "./pricing-core.mjs";
import "./usage-metrics-core.mjs";

const CORE_KEY = "__vibeusageUsagePricingCore";
const DEFAULT_MODEL = "unknown";

const usageModelCore = globalThis.__vibeusageUsageModelCore;
if (!usageModelCore) throw new Error("usage-model core not initialized");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");
const pricingCore = globalThis.__vibeusagePricingCore;
if (!pricingCore) throw new Error("pricing core not initialized");

const { fetchAliasRows, buildAliasTimeline, resolveIdentityAtDate } = usageModelCore;
const { buildPricingBucketKey, parsePricingBucketKey } = usageMetricsCore;
const { resolvePricingProfile, computeUsageCost } = pricingCore;

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

  const aliasRows =
    usageModelList.length > 0
      ? await fetchAliasRows({ edgeClient, usageModels: usageModelList, effectiveDate })
      : [];
  const timeline = buildAliasTimeline({ usageModels: usageModelList, aliasRows });
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

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      resolveBucketedUsagePricing,
      accumulateSourceCostMicros,
      resolveImpliedModelId,
      resolveSummaryPricingMode,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
