"use strict";

require("./usage-model-core");
require("./pricing-core");

const pricingCore = globalThis.__vibeusagePricingCore;
if (!pricingCore) throw new Error("pricing core not initialized");

module.exports = {
  buildPricingMetadata: pricingCore.buildPricingMetadata,
  computeUsageCost: pricingCore.computeUsageCost,
  formatUsdFromMicros: pricingCore.formatUsdFromMicros,
  getDefaultPricingProfile: pricingCore.getDefaultPricingProfile,
  _getPricingDefaults: pricingCore.getPricingDefaults,
  resolvePricingProfile: pricingCore.resolvePricingProfile,
};
