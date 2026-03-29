import "./canary-core.mjs";
import "./pagination-core.mjs";
import "./usage-model-core.mjs";
import "./usage-filter-core.mjs";
import "./usage-hourly-query-core.mjs";
import "./usage-row-core.mjs";

const CORE_KEY = "__vibeusageUsageRowCollectorCore";
const usageFilterCore = globalThis.__vibeusageUsageFilterCore;
const usageHourlyQueryCore = globalThis.__vibeusageUsageHourlyQueryCore;
const usageRowCore = globalThis.__vibeusageUsageRowCore;

if (!usageFilterCore) throw new Error("usage filter core not initialized");
if (!usageHourlyQueryCore) throw new Error("usage hourly query core not initialized");
if (!usageRowCore) throw new Error("usage row core not initialized");

async function collectHourlyUsageRows({
  edgeClient,
  userId,
  source,
  usageModels,
  canonicalModel,
  hasModelFilter = false,
  aliasTimeline = null,
  effectiveDate,
  startIso,
  endIso,
  select,
  pageSize,
  rowStateOptions,
  onUsageRow,
} = {}) {
  if (typeof onUsageRow !== "function") {
    throw new Error("onUsageRow must be a function");
  }

  const { error, rowCount } = await usageHourlyQueryCore.forEachHourlyUsagePage({
    edgeClient,
    userId,
    source,
    usageModels,
    canonicalModel,
    startIso,
    endIso,
    select: select || usageHourlyQueryCore.DETAILED_HOURLY_USAGE_SELECT,
    pageSize,
    onPage: async (rows) => {
      for (const row of rows) {
        const usageRow = usageRowCore.resolveHourlyUsageRowState({
          row,
          source,
          effectiveDate,
          ...(rowStateOptions || {}),
        });
        if (!usageRow) continue;
        if (
          !usageFilterCore.shouldIncludeUsageRow({
            row,
            canonicalModel,
            hasModelFilter,
            aliasTimeline,
            to: effectiveDate,
          })
        ) {
          continue;
        }
        await onUsageRow({ row, usageRow });
      }
    },
  });

  return { error, rowCount };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      collectHourlyUsageRows,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
