import "../numbers.js";
import "../date.js";
import "../../../shared/usage-hourly-core.mjs";
import { collectFilteredUsageRows } from "./usage-filtered-rows.js";

const usageHourlyCore = globalThis.__vibeusageUsageHourlyCore;
if (!usageHourlyCore) throw new Error("usage hourly core not initialized");

export const createHourlyBuckets = usageHourlyCore.createHourlyBuckets;
export const addHourlyBucketTotals = usageHourlyCore.addHourlyBucketTotals;
export const resolveHalfHourSlot = usageHourlyCore.resolveHalfHourSlot;
export const formatHourKeyFromValue = usageHourlyCore.formatHourKeyFromValue;
export const buildHourlyResponse = usageHourlyCore.buildHourlyResponse;
export const resolveUsageHourlyRequestContext = usageHourlyCore.resolveUsageHourlyRequestContext;
export const resolveUsageHourlyRowSlot = usageHourlyCore.resolveUsageHourlyRowSlot;

export async function collectHourlyUsageBuckets({
  logger,
  edgeClient,
  userId,
  source,
  usageModels,
  canonicalModel,
  hasModelFilter,
  aliasTimeline,
  effectiveDate,
  startIso,
  endIso,
  timeMode,
  dayKey,
  tzContext,
  buckets,
} = {}) {
  return collectFilteredUsageRows({
    logger,
    queryLabel: "usage_hourly_raw",
    logMeta: {
      range_days: 1,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes)
        ? tzContext.offsetMinutes
        : null,
    },
    edgeClient,
    userId,
    source,
    usageModels,
    canonicalModel,
    hasModelFilter,
    aliasTimeline,
    effectiveDate,
    startIso,
    endIso,
    onUsageRow: ({ row, usageRow }) => {
      const slot = usageHourlyCore.resolveUsageHourlyRowSlot({
        usageDate: usageRow.date,
        timeMode,
        dayKey,
        tzContext,
      });
      if (!Number.isFinite(slot)) return;

      const bucket = buckets?.[slot];
      usageHourlyCore.addHourlyBucketTotals({
        bucket,
        totalTokens: row?.total_tokens,
        billableTokens: usageRow.billable,
        inputTokens: row?.input_tokens,
        cachedInputTokens: row?.cached_input_tokens,
        outputTokens: row?.output_tokens,
        reasoningOutputTokens: row?.reasoning_output_tokens,
      });
    },
  });
}
