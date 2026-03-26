import { applyCanaryFilter } from "./shared/canary.js";
import { AGGREGATE_HOURLY_USAGE_SELECT } from "./shared/db/usage-hourly.js";
import {
  addHourlyBucketTotals,
  buildHourlyResponse,
  collectHourlyUsageBuckets,
  createHourlyBuckets,
  formatHourKeyFromValue,
  resolveUsageHourlyRequestContext,
} from "./shared/core/usage-hourly.js";
import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import {
  resolveUsageFilterRequestSnapshot,
} from "./shared/core/usage-filter-request.js";
import {
  getUsageTimeZoneContext,
  normalizeIso,
} from "./shared/date.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import {
  applyUsageModelFilter,
  resolveBillableTotals,
} from "./shared/usage-summary-support.js";

const MIN_INTERVAL_MINUTES = 30;

export default withRequestLogging("vibeusage-usage-hourly", async function (request, logger) {
  const endpoint = prepareUsageEndpoint({ request, logger });
  if (!endpoint.ok) return endpoint.response;
  const { url, respond, bearer } = endpoint;

  const access = await requireUsageAccess({ respond, bearer });
  if (!access.ok) return access.response;
  const { auth } = access;

  const tzContext = getUsageTimeZoneContext(url);
  const requestContext = resolveUsageHourlyRequestContext({ url, tzContext });
  if (!requestContext.ok) return respondUsageRequestError(respond, requestContext);
  const { timeMode, dayKey, startUtc, endUtc, startIso, endIso } = requestContext;
  const filterSnapshot = await resolveUsageFilterRequestSnapshot({
    url,
    edgeClient: auth.edgeClient,
    effectiveDate: dayKey,
  });
  if (!filterSnapshot.ok) return respondUsageRequestError(respond, filterSnapshot);
  const { source, model, canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    filterSnapshot;

  const { hourKeys, buckets, bucketMap } = createHourlyBuckets(dayKey);
  const syncMeta = await getSyncMeta({
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    startUtc,
    endUtc,
    tzContext,
  });

  if (timeMode === "utc") {
    const aggregateStartMs = Date.now();
    const aggregateRows = hasModelFilter
      ? null
      : await tryAggregateHourlyTotals({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          startIso,
          endIso,
          source,
          canonicalModel,
          usageModels,
        });
    const aggregateDurationMs = Date.now() - aggregateStartMs;
    logSlowQuery(logger, {
      query_label: "usage_hourly_aggregate",
      duration_ms: aggregateDurationMs,
      row_count: Array.isArray(aggregateRows) ? aggregateRows.length : 0,
      range_days: 1,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
      agg_hit: Boolean(aggregateRows),
    });

    if (aggregateRows) {
      for (const row of aggregateRows) {
        const key = formatHourKeyFromValue(row?.hour);
        const bucket = key ? bucketMap.get(key) : null;
        if (!bucket) continue;

        const rowCount = Number(row?.count_rows);
        const billableCount = Number(row?.count_billable_total_tokens);
        const hasCompleteBillable =
          Number.isFinite(rowCount) &&
          Number.isFinite(billableCount) &&
          rowCount > 0 &&
          billableCount === rowCount;
        const hasStoredBillable =
          row &&
          Object.prototype.hasOwnProperty.call(row, "sum_billable_total_tokens") &&
          row.sum_billable_total_tokens != null &&
          hasCompleteBillable;
        const { billable } = resolveBillableTotals({
          row,
          source: row?.source || source,
          billableField: "sum_billable_total_tokens",
          totals: {
            total_tokens: row?.sum_total_tokens,
            input_tokens: row?.sum_input_tokens,
            cached_input_tokens: row?.sum_cached_input_tokens,
            output_tokens: row?.sum_output_tokens,
            reasoning_output_tokens: row?.sum_reasoning_output_tokens,
          },
          hasStoredBillable,
        });
        addHourlyBucketTotals({
          bucket,
          totalTokens: row?.sum_total_tokens,
          billableTokens: billable,
          inputTokens: row?.sum_input_tokens,
          cachedInputTokens: row?.sum_cached_input_tokens,
          outputTokens: row?.sum_output_tokens,
          reasoningOutputTokens: row?.sum_reasoning_output_tokens,
        });
      }

      return respond(
        {
          day: dayKey,
          data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
          sync: buildSyncResponse(syncMeta),
        },
        200,
        aggregateDurationMs,
      );
    }
  }

  const { error, queryDurationMs } = await collectHourlyUsageBuckets({
    logger,
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    source,
    usageModels,
    canonicalModel,
    hasModelFilter,
    aliasTimeline,
    effectiveDate: dayKey,
    startIso,
    endIso,
    timeMode,
    dayKey,
    tzContext,
    buckets,
  });

  if (error) return respond({ error: error.message }, 500, queryDurationMs);

  return respond(
    {
      day: dayKey,
      data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
      sync: buildSyncResponse(syncMeta),
    },
    200,
    queryDurationMs,
  );
});

async function tryAggregateHourlyTotals({
  edgeClient,
  userId,
  startIso,
  endIso,
  source,
  canonicalModel,
  usageModels,
}) {
  try {
    let query = edgeClient.database
      .from("vibeusage_tracker_hourly")
      .select(AGGREGATE_HOURLY_USAGE_SELECT)
      .eq("user_id", userId);
    if (source) query = query.eq("source", source);
    if (Array.isArray(usageModels) && usageModels.length > 0) {
      query = applyUsageModelFilter(query, usageModels);
    }
    query = applyCanaryFilter(query, { source, model: canonicalModel });
    const { data, error } = await query
      .gte("hour_start", startIso)
      .lt("hour_start", endIso)
      .order("hour", { ascending: true })
      .order("source", { ascending: true });
    if (error) return null;
    return data || [];
  } catch (_error) {
    return null;
  }
}

async function getSyncMeta({ edgeClient, userId, startUtc, endUtc, tzContext }) {
  const lastSyncAt = await getLastSyncAt({ edgeClient, userId });
  const lastSyncIso = normalizeIso(lastSyncAt);
  if (
    !lastSyncIso ||
    !(startUtc instanceof Date) ||
    !(endUtc instanceof Date) ||
    !Number.isFinite(startUtc.getTime()) ||
    !Number.isFinite(endUtc.getTime())
  ) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: null };
  }

  const dayStartMs = startUtc.getTime();
  const dayEndMs = endUtc.getTime();
  const lastMs = Date.parse(lastSyncIso);
  if (!Number.isFinite(lastMs)) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: null };
  }
  if (lastMs < dayStartMs) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: -1 };
  }
  if (lastMs >= dayEndMs) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: 47 };
  }

  const lastParts = getLocalParts(new Date(lastMs), tzContext);
  const lastHour = Number(lastParts?.hour);
  const lastMinute = Number(lastParts?.minute || 0);
  if (!Number.isFinite(lastHour) || !Number.isFinite(lastMinute)) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: null };
  }
  const slot = lastHour * 2 + (lastMinute >= 30 ? 1 : 0);
  return { lastSyncAt: lastSyncIso, missingAfterSlot: slot };
}

async function getLastSyncAt({ edgeClient, userId }) {
  try {
    const { data, error } = await edgeClient.database
      .from("vibeusage_tracker_device_tokens")
      .select("last_sync_at")
      .eq("user_id", userId)
      .order("last_sync_at", { ascending: false })
      .limit(1);
    if (error) return null;
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0]?.last_sync_at || null;
  } catch (_error) {
    return null;
  }
}

function buildSyncResponse(syncMeta) {
  return {
    last_sync_at: syncMeta?.lastSyncAt || null,
    min_interval_minutes: MIN_INTERVAL_MINUTES,
  };
}
