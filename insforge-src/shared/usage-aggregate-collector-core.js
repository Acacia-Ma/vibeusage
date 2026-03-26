"use strict";

require("./canary-core");
require("./date-core");
require("./pagination-core");
require("./usage-filter-core");
require("./usage-pricing-core");
require("./usage-hourly-query-core");
require("./usage-rollup-core");

const CORE_KEY = "__vibeusageUsageAggregateCollectorCore";
const usageFilterCore = globalThis.__vibeusageUsageFilterCore;
if (!usageFilterCore) throw new Error("usage filter core not initialized");
const dateCore = globalThis.__vibeusageDateCore;
if (!dateCore) throw new Error("date core not initialized");
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");
const usageRollupCore = globalThis.__vibeusageUsageRollupCore;
if (!usageRollupCore) throw new Error("usage rollup core not initialized");

const { addUtcDays, formatDateUTC } = dateCore;
const { shouldIncludeUsageRow } = usageFilterCore;
const { accumulateAggregateUsageRow, createAggregateUsageState } = usagePricingCore;
const { DETAILED_HOURLY_USAGE_SELECT, forEachHourlyUsagePage } = usageHourlyQueryCore;
const { fetchRollupRows, isRollupEnabled } = usageRollupCore;
const MIN_ROLLUP_RANGE_DAYS = 30;

async function collectAggregateUsageRange({
  edgeClient,
  userId,
  source,
  usageModels,
  canonicalModel,
  startIso,
  endIso,
  state,
  effectiveDate,
  hasModelFilter = false,
  aliasTimeline,
  defaultSource = "codex",
  pageSize,
  select = DETAILED_HOURLY_USAGE_SELECT,
  onAccumulatedRow,
  shouldAccumulateRow,
  createState,
  preferRollup = false,
} = {}) {
  const buildAggregateState =
    typeof createState === "function"
      ? createState
      : () => (state && typeof state === "object" ? state : createAggregateUsageState());
  let aggregateState = state && typeof state === "object" ? state : buildAggregateState();
  let rowCount = 0;
  let rollupHit = false;

  const resetAggregation = () => {
    aggregateState = buildAggregateState();
    rowCount = 0;
    rollupHit = false;
  };

  const ingestRow = async (row) => {
    if (
      !shouldIncludeUsageRow({
        row,
        canonicalModel,
        hasModelFilter,
        aliasTimeline,
        to: effectiveDate,
      })
    ) {
      return;
    }
    if (typeof shouldAccumulateRow === "function" && !shouldAccumulateRow(row)) {
      return;
    }
    const accumulation = accumulateAggregateUsageRow({
      state: aggregateState,
      row,
      effectiveDate,
      defaultSource,
    });
    if (typeof onAccumulatedRow === "function") {
      await onAccumulatedRow({
        row,
        accumulation,
        state: aggregateState,
      });
    }
  };

  const normalizeRollupRow = (row) => {
    if (!row?.day || row?.hour_start) return row;
    return {
      ...row,
      hour_start: `${row.day}T00:00:00.000Z`,
    };
  };

  const sumHourlyRange = async (rangeStartIso, rangeEndIso) => {
    const { error } = await forEachHourlyUsagePage({
      edgeClient,
      userId,
      source,
      usageModels,
      canonicalModel,
      startIso: rangeStartIso,
      endIso: rangeEndIso,
      pageSize,
      select,
      onPage: async (rows) => {
        for (const row of rows) {
          rowCount += 1;
          await ingestRow(row);
        }
      },
    });
    if (error) return { ok: false, error };
    return { ok: true };
  };

  const sumRollupRange = async (fromDay, toDay) => {
    let rows = [];
    if (hasModelFilter && Array.isArray(usageModels) && usageModels.length > 0) {
      for (const usageModel of usageModels) {
        const rollupRes = await fetchRollupRows({
          edgeClient,
          userId,
          fromDay,
          toDay,
          source,
          model: usageModel,
        });
        if (!rollupRes.ok) return { ok: false, error: rollupRes.error };
        rows = rows.concat(Array.isArray(rollupRes.rows) ? rollupRes.rows : []);
      }
    } else {
      const rollupRes = await fetchRollupRows({
        edgeClient,
        userId,
        fromDay,
        toDay,
        source,
        model: canonicalModel || null,
      });
      if (!rollupRes.ok) return { ok: false, error: rollupRes.error };
      rows = Array.isArray(rollupRes.rows) ? rollupRes.rows : [];
    }
    rowCount += rows.length;
    if (rows.length > 0) {
      rollupHit = true;
    }
    for (const row of rows) {
      await ingestRow(normalizeRollupRow(row));
    }
    return { ok: true, rowsCount: rows.length };
  };

  const collectWithRollup = async () => {
    if (!preferRollup || !isRollupEnabled()) {
      return await sumHourlyRange(startIso, endIso);
    }

    const rangeStartUtc = new Date(startIso);
    const rangeEndUtc = new Date(endIso);
    if (!Number.isFinite(rangeStartUtc.getTime()) || !Number.isFinite(rangeEndUtc.getTime())) {
      return await sumHourlyRange(startIso, endIso);
    }

    const rangeStartDayUtc = new Date(
      Date.UTC(
        rangeStartUtc.getUTCFullYear(),
        rangeStartUtc.getUTCMonth(),
        rangeStartUtc.getUTCDate(),
      ),
    );
    const rangeEndDayUtc = new Date(
      Date.UTC(rangeEndUtc.getUTCFullYear(), rangeEndUtc.getUTCMonth(), rangeEndUtc.getUTCDate()),
    );
    const sameUtcDay = rangeStartDayUtc.getTime() === rangeEndDayUtc.getTime();
    const rangeDays =
      Math.floor((rangeEndDayUtc.getTime() - rangeStartDayUtc.getTime()) / 86400000) + 1;
    const startIsBoundary = rangeStartUtc.getTime() === rangeStartDayUtc.getTime();
    const endIsBoundary = rangeEndUtc.getTime() === rangeEndDayUtc.getTime();

    if (sameUtcDay || rangeDays < MIN_ROLLUP_RANGE_DAYS) {
      return await sumHourlyRange(startIso, endIso);
    }

    let hourlyError = null;
    let middleRollupRows = null;
    const rollupStartDate = startIsBoundary ? rangeStartDayUtc : addUtcDays(rangeStartDayUtc, 1);
    const rollupEndDate = addUtcDays(rangeEndDayUtc, -1);

    if (!startIsBoundary) {
      const hourlyRes = await sumHourlyRange(startIso, rollupStartDate.toISOString());
      if (!hourlyRes.ok) hourlyError = hourlyRes.error;
    }
    if (!endIsBoundary && !hourlyError) {
      const hourlyRes = await sumHourlyRange(rangeEndDayUtc.toISOString(), endIso);
      if (!hourlyRes.ok) hourlyError = hourlyRes.error;
    }
    if (!hourlyError && rollupStartDate.getTime() <= rollupEndDate.getTime()) {
      const rollupRes = await sumRollupRange(
        formatDateUTC(rollupStartDate),
        formatDateUTC(rollupEndDate),
      );
      if (!rollupRes.ok) {
        hourlyError = rollupRes.error;
      } else {
        middleRollupRows = rollupRes.rowsCount;
      }
    }

    if (hourlyError || middleRollupRows === 0) {
      resetAggregation();
      return await sumHourlyRange(startIso, endIso);
    }

    return { ok: true };
  };

  const result = await collectWithRollup();
  return {
    error: result.ok ? null : result.error,
    rowCount,
    state: aggregateState,
    rollupHit,
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      collectAggregateUsageRange,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
