import "../../shared/http-core.mjs";

const httpCore = globalThis.__vibeusageHttpCore;
if (!httpCore) throw new Error("http core not initialized");

export const corsHeaders = httpCore.corsHeaders;
export const handleOptions = httpCore.handleOptions;
export const json = httpCore.json;
export const requireMethod = httpCore.requireMethod;
export const readJson = httpCore.readJson;
