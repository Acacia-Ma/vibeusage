"use strict";

import "./canary-core.mjs";
import "./pagination-core.mjs";
import "./usage-filter-core.mjs";
import "./usage-pricing-core.mjs";
import "./usage-hourly-query-core.mjs";

const CORE_KEY = "__vibeusageUsageAggregateCollectorCore";
const usageFilterCore = globalThis.__vibeusageUsageFilterCore;
if (!usageFilterCore) throw new Error("usage filter core not initialized");
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");

const { shouldIncludeUsageRow } = usageFilterCore;
const { accumulateAggregateUsageRow, createAggregateUsageState } = usagePricingCore;
const { forEachHourlyUsagePage } = usageHourlyQueryCore;
const AGGREGATE_USAGE_SELECT =
  "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens";

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
  select = AGGREGATE_USAGE_SELECT,
  onAccumulatedRow,
  shouldAccumulateRow,
} = {}) {
  const aggregateState =
    state && typeof state === "object" ? state : createAggregateUsageState();

  const { error, rowCount } = await forEachHourlyUsagePage({
    edgeClient,
    userId,
    source,
    usageModels,
    canonicalModel,
    startIso,
    endIso,
    pageSize,
    select,
    onPage: async (rows) => {
      for (const row of rows) {
        if (
          !shouldIncludeUsageRow({
            row,
            canonicalModel,
            hasModelFilter,
            aliasTimeline,
            to: effectiveDate,
          })
        ) {
          continue;
        }
        if (typeof shouldAccumulateRow === "function" && !shouldAccumulateRow(row)) {
          continue;
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
      }
    },
  });

  return { error, rowCount, state: aggregateState };
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
