import "../date.js";
import "../../../shared/usage-heatmap-core.mjs";

const usageHeatmapCore = globalThis.__vibeusageUsageHeatmapCore;
if (!usageHeatmapCore) throw new Error("usage heatmap core not initialized");

export const accumulateHeatmapDayValue = usageHeatmapCore.accumulateHeatmapDayValue;
export const buildUsageHeatmapPayload = usageHeatmapCore.buildUsageHeatmapPayload;
export const normalizeHeatmapToDate = usageHeatmapCore.normalizeHeatmapToDate;
export const normalizeHeatmapWeekStartsOn = usageHeatmapCore.normalizeHeatmapWeekStartsOn;
export const normalizeHeatmapWeeks = usageHeatmapCore.normalizeHeatmapWeeks;
