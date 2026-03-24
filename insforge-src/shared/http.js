"use strict";

require("./http-core");

const httpCore = globalThis.__vibeusageHttpCore;
if (!httpCore) throw new Error("http core not initialized");

module.exports = {
  corsHeaders: httpCore.corsHeaders,
  handleOptions: httpCore.handleOptions,
  json: httpCore.json,
  requireMethod: httpCore.requireMethod,
  readJson: httpCore.readJson,
};
