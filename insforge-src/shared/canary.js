"use strict";

require("./canary-core");

const canaryCore = globalThis.__vibeusageCanaryCore;
if (!canaryCore) throw new Error("canary core not initialized");

module.exports = {
  applyCanaryFilter: canaryCore.applyCanaryFilter,
  isCanaryTag: canaryCore.isCanaryTag,
};
