import "./env.js";
import "../../shared/date-core.mjs";

const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");

export const isDate = dateCore.isDate;
export const toUtcDay = dateCore.toUtcDay;
export const formatDateUTC = dateCore.formatDateUTC;
export const normalizeIso = dateCore.normalizeIso;
export const parseUtcDateString = dateCore.parseUtcDateString;
export const addUtcDays = dateCore.addUtcDays;
export const computeHeatmapWindowUtc = dateCore.computeHeatmapWindowUtc;
export const parseDateParts = dateCore.parseDateParts;
export const formatDateParts = dateCore.formatDateParts;
export const dateFromPartsUTC = dateCore.dateFromPartsUTC;
export const addDatePartsDays = dateCore.addDatePartsDays;
export const addDatePartsMonths = dateCore.addDatePartsMonths;
export const getUsageTimeZoneContext = dateCore.getUsageTimeZoneContext;
export const isUtcTimeZone = dateCore.isUtcTimeZone;
export const getTimeZoneOffsetMinutes = dateCore.getTimeZoneOffsetMinutes;
export const getLocalParts = dateCore.getLocalParts;
export const formatLocalDateKey = dateCore.formatLocalDateKey;
export const localDatePartsToUtc = dateCore.localDatePartsToUtc;
export const normalizeDateRangeLocal = dateCore.normalizeDateRangeLocal;
export const listDateStrings = dateCore.listDateStrings;
export const getUsageMaxDays = dateCore.getUsageMaxDays;
export const isWithinInterval = dateCore.isWithinInterval;
