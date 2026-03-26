"use strict";

require("./runtime-primitives-core");

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

module.exports = {
  MAX_SOURCE_LENGTH: runtimePrimitivesCore.MAX_SOURCE_LENGTH,
  normalizeSource: runtimePrimitivesCore.normalizeSource,
  getSourceParam: runtimePrimitivesCore.getSourceParam,
};
