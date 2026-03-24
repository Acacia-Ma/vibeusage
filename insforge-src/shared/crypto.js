"use strict";

require("./crypto-core");

const cryptoCore = globalThis.__vibeusageCryptoCore;
if (!cryptoCore) throw new Error("crypto core not initialized");

module.exports = {
  sha256Hex: cryptoCore.sha256Hex,
};
