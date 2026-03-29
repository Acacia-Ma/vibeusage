"use strict";

require("./env");
require("./date-core");

const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");

module.exports = {
  isDate: dateCore.isDate,
  toUtcDay: dateCore.toUtcDay,
  formatDateUTC: dateCore.formatDateUTC,
  normalizeIso: dateCore.normalizeIso,
  normalizeDateRange: dateCore.normalizeDateRange,
  parseUtcDateString: dateCore.parseUtcDateString,
  addUtcDays: dateCore.addUtcDays,
  computeHeatmapWindowUtc: dateCore.computeHeatmapWindowUtc,
  parseDateParts: dateCore.parseDateParts,
  formatDateParts: dateCore.formatDateParts,
  dateFromPartsUTC: dateCore.dateFromPartsUTC,
  datePartsFromDateUTC: dateCore.datePartsFromDateUTC,
  addDatePartsDays: dateCore.addDatePartsDays,
  addDatePartsMonths: dateCore.addDatePartsMonths,
  normalizeTimeZone: dateCore.normalizeTimeZone,
  getUsageTimeZoneContext: dateCore.getUsageTimeZoneContext,
  isUtcTimeZone: dateCore.isUtcTimeZone,
  getTimeZoneOffsetMinutes: dateCore.getTimeZoneOffsetMinutes,
  getLocalParts: dateCore.getLocalParts,
  formatLocalDateKey: dateCore.formatLocalDateKey,
  localDatePartsToUtc: dateCore.localDatePartsToUtc,
  normalizeDateRangeLocal: dateCore.normalizeDateRangeLocal,
  listDateStrings: dateCore.listDateStrings,
  resolveUsageDateRangeLocal: dateCore.resolveUsageDateRangeLocal,
  getUsageMaxDays: dateCore.getUsageMaxDays,
  isWithinInterval: dateCore.isWithinInterval,
};
