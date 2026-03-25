import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { applyCanaryFilter } from "./shared/canary.js";
import {
  addHourlyBucketTotals,
  buildHourlyResponse,
  createHourlyBuckets,
  formatHourKeyFromValue,
  resolveHalfHourSlot,
} from "./shared/core/usage-hourly.js";
import { collectHourlyUsageRows } from "./shared/core/usage-row-collector.js";
import { createUsageJsonResponder } from "./shared/core/usage-response.js";
import {
  addDatePartsDays,
  addUtcDays,
  formatDateParts,
  formatDateUTC,
  getLocalParts,
  getUsageTimeZoneContext,
  isUtcTimeZone,
  localDatePartsToUtc,
  normalizeIso,
  parseDateParts,
  parseUtcDateString,
} from "./shared/date.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { getSourceParam } from "./shared/source.js";
import {
  applyUsageModelFilter,
  getModelParam,
  resolveBillableTotals,
  resolveUsageFilterContext,
} from "./shared/usage-summary-support.js";

const MIN_INTERVAL_MINUTES = 30;

export default withRequestLogging("vibeusage-usage-hourly", async function (request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const url = new URL(request.url);
  const respond = createUsageJsonResponder({ url, logger });

  if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

  const baseUrl = getBaseUrl();
  const auth = await getAccessContext({ baseUrl, bearer, allowPublic: true });
  if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;

  if (isUtcTimeZone(tzContext)) {
    const dayRaw = url.searchParams.get("day");
    const today = parseUtcDateString(formatDateUTC(new Date()));
    const day = dayRaw ? parseUtcDateString(dayRaw) : today;
    if (!day) return respond({ error: "Invalid day" }, 400, 0);

    const startUtc = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0),
    );
    const startIso = startUtc.toISOString();
    const endDate = addUtcDays(day, 1);
    const endUtc = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0),
    );
    const endIso = endUtc.toISOString();

    const dayLabel = formatDateUTC(day);
    const { hourKeys, buckets, bucketMap } = createHourlyBuckets(dayLabel);
    const syncMeta = await getSyncMeta({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      startUtc,
      endUtc,
      tzContext,
    });

    const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
      await resolveUsageFilterContext({
        edgeClient: auth.edgeClient,
        canonicalModel: model,
        effectiveDate: dayLabel,
      });

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
          day: dayLabel,
          data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
          sync: buildSyncResponse(syncMeta),
        },
        200,
        aggregateDurationMs,
      );
    }

    const queryStartMs = Date.now();
    let rowCount = 0;
    const { error, rowCount: scannedRows } = await collectHourlyUsageRows({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      usageModels,
      canonicalModel,
      hasModelFilter,
      aliasTimeline,
      effectiveDate: dayLabel,
      startIso,
      endIso,
      select:
        "hour_start,model,source,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
      onUsageRow: ({ row, usageRow }) => {
        const slot = resolveHalfHourSlot({
          hour: usageRow.date.getUTCHours(),
          minute: usageRow.date.getUTCMinutes(),
        });
        if (!Number.isFinite(slot)) return;

        const bucket = buckets[slot];
        addHourlyBucketTotals({
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
    rowCount += scannedRows;
    const queryDurationMs = Date.now() - queryStartMs;
    logSlowQuery(logger, {
      query_label: "usage_hourly_raw",
      duration_ms: queryDurationMs,
      row_count: rowCount,
      range_days: 1,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    });

    if (error) return respond({ error: error.message }, 500, queryDurationMs);

    return respond(
      {
        day: dayLabel,
        data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
        sync: buildSyncResponse(syncMeta),
      },
      200,
      queryDurationMs,
    );
  }

  const dayRaw = url.searchParams.get("day");
  const todayKey = formatDateParts(getLocalParts(new Date(), tzContext));
  if (dayRaw && !parseDateParts(dayRaw)) return respond({ error: "Invalid day" }, 400, 0);
  const dayKey = dayRaw || todayKey;
  const dayParts = parseDateParts(dayKey);
  if (!dayParts) return respond({ error: "Invalid day" }, 400, 0);

  const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    await resolveUsageFilterContext({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: dayKey,
    });

  const startUtc = localDatePartsToUtc({ ...dayParts, hour: 0, minute: 0, second: 0 }, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(dayParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const { hourKeys, buckets, bucketMap } = createHourlyBuckets(dayKey);
  const syncMeta = await getSyncMeta({
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    startUtc,
    endUtc,
    tzContext,
  });

  const queryStartMs = Date.now();
  let rowCount = 0;
  const { error, rowCount: scannedRows } = await collectHourlyUsageRows({
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
    select:
      "hour_start,model,source,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
    onUsageRow: ({ row, usageRow }) => {
      const localParts = getLocalParts(usageRow.date, tzContext);
      const localDay = formatDateParts(localParts);
      if (localDay !== dayKey) return;
      const hour = Number(localParts.hour);
      const minute = Number(localParts.minute);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
      const slot = resolveHalfHourSlot({ hour, minute });
      if (!Number.isFinite(slot)) return;

      const bucket = buckets[slot];
      addHourlyBucketTotals({
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
  rowCount += scannedRows;
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: "usage_hourly_raw",
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: 1,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
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
      .select(
        "source,hour:hour_start,sum_total_tokens:sum(total_tokens),sum_input_tokens:sum(input_tokens),sum_cached_input_tokens:sum(cached_input_tokens),sum_output_tokens:sum(output_tokens),sum_reasoning_output_tokens:sum(reasoning_output_tokens),sum_billable_total_tokens:sum(billable_total_tokens),count_rows:count(),count_billable_total_tokens:count(billable_total_tokens)",
      )
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
