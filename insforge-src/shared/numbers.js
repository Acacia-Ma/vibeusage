"use strict";

require("./runtime-primitives-core");

const runtimePrimitivesCore = globalThis.__vibeusageRuntimePrimitivesCore;
if (!runtimePrimitivesCore) throw new Error("runtime primitives core not initialized");

module.exports = {
  toBigInt: runtimePrimitivesCore.toBigInt,
  toPositiveInt: runtimePrimitivesCore.toPositiveInt,
  toPositiveIntOrNull: runtimePrimitivesCore.toPositiveIntOrNull,
};
