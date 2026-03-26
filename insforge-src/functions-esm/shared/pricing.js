import "../../shared/runtime-primitives-core.mjs";
import "../../shared/usage-model-core.mjs";
import "../../shared/env-core.mjs";
import "../../shared/pricing-core.mjs";

const pricingCore = globalThis.__vibeusagePricingCore;
if (!pricingCore) throw new Error("pricing core not initialized");

export const resolvePricingProfile = pricingCore.resolvePricingProfile;
export const computeUsageCost = pricingCore.computeUsageCost;
export const buildPricingMetadata = pricingCore.buildPricingMetadata;
export const formatUsdFromMicros = pricingCore.formatUsdFromMicros;
