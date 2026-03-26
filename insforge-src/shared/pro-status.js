"use strict";

require("./pro-status-core");

const proStatusCore = globalThis.__vibeusageProStatusCore;
if (!proStatusCore) throw new Error("pro status core not initialized");

module.exports = {
  CUTOFF_UTC_ISO: proStatusCore.CUTOFF_UTC_ISO,
  REGISTRATION_YEARS: proStatusCore.REGISTRATION_YEARS,
  computeProStatus: proStatusCore.computeProStatus,
};
