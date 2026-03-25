import "../date.js";
import "../../../shared/usage-heatmap-core.mjs";

const usageHeatmapCore = globalThis.__vibeusageUsageHeatmapCore;
if (!usageHeatmapCore) throw new Error("usage heatmap core not initialized");

export const buildUsageHeatmapPayload = usageHeatmapCore.buildUsageHeatmapPayload;
