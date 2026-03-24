import "../../shared/crypto-core.mjs";

const cryptoCore = globalThis.__vibeusageCryptoCore;
if (!cryptoCore) throw new Error("crypto core not initialized");

export const sha256Hex = cryptoCore.sha256Hex;
