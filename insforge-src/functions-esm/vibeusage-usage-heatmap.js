import { getAccessContext, getBearerToken } from "./shared/auth.js";
import {
  accumulateHeatmapDayValue,
  buildUsageHeatmapPayload,
  normalizeHeatmapToDate,
  normalizeHeatmapWeekStartsOn,
  normalizeHeatmapWeeks,
} from "./shared/core/usage-heatmap.js";
import {
  resolveUsageFilterRequestContext,
  resolveUsageFilterRequestParams,
} from "./shared/core/usage-filter-request.js";
import { collectHourlyUsageRows } from "./shared/core/usage-row-collector.js";
import { createUsageJsonResponder } from "./shared/core/usage-response.js";
import {
  addDatePartsDays,
  addUtcDays,
  computeHeatmapWindowUtc,
  dateFromPartsUTC,
  formatDateParts,
  formatDateUTC,
  formatLocalDateKey,
  getLocalParts,
  getUsageTimeZoneContext,
  isUtcTimeZone,
  localDatePartsToUtc,
  parseDateParts,
} from "./shared/date.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";

export default withRequestLogging("vibeusage-usage-heatmap", async function (request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const url = new URL(request.url);
  const respond = createUsageJsonResponder({ url, logger });

  if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

  const tzContext = getUsageTimeZoneContext(url);
  const requestParams = resolveUsageFilterRequestParams({ url });
  if (!requestParams.ok) return respond({ error: requestParams.error }, requestParams.status || 400, 0);
  const { source, model } = requestParams;

  const weeksRaw = url.searchParams.get("weeks");
  const weeks = normalizeHeatmapWeeks(weeksRaw);
  if (!weeks) return respond({ error: "Invalid weeks" }, 400, 0);

  const weekStartsOnRaw = url.searchParams.get("week_starts_on");
  const weekStartsOn = normalizeHeatmapWeekStartsOn(weekStartsOnRaw);
  if (!weekStartsOn) return respond({ error: "Invalid week_starts_on" }, 400, 0);

  const toRaw = url.searchParams.get("to");

  if (isUtcTimeZone(tzContext)) {
    const to = normalizeHeatmapToDate(toRaw);
    if (!to) return respond({ error: "Invalid to" }, 400, 0);

    const { from, gridStart, end } = computeHeatmapWindowUtc({
      weeks,
      weekStartsOn,
      to,
    });

    const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
    if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

    const startIso = gridStart.toISOString();
    const endUtc = addUtcDays(end, 1);
    const endIso = endUtc.toISOString();

    const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
      await resolveUsageFilterRequestContext({
        edgeClient: auth.edgeClient,
        model,
        effectiveDate: to,
      });

    const valuesByDay = new Map();
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
      effectiveDate: to,
      startIso,
      endIso,
      select:
        "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
      onUsageRow: ({ usageRow }) => {
        accumulateHeatmapDayValue({
          valuesByDay,
          dayKey: formatDateUTC(usageRow.date),
          billable: usageRow.billable,
        });
      },
    });
    rowCount += scannedRows;
    const queryDurationMs = Date.now() - queryStartMs;
    logSlowQuery(logger, {
      query_label: "usage_heatmap",
      duration_ms: queryDurationMs,
      row_count: rowCount,
      range_weeks: weeks,
      range_days: weeks * 7,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    });

    if (error) return respond({ error: error.message }, 500, queryDurationMs);

    return respond(
      buildUsageHeatmapPayload({
        valuesByDay,
        gridStart,
        end,
        weeks,
        from,
        to,
        weekStartsOn,
        getDayKey: formatDateUTC,
        renderDay: formatDateUTC,
      }),
      200,
      queryDurationMs,
    );
  }

  const todayParts = getLocalParts(new Date(), tzContext);
  const toParts = toRaw
    ? parseDateParts(toRaw)
    : {
        year: todayParts.year,
        month: todayParts.month,
        day: todayParts.day,
      };
  if (!toParts) return respond({ error: "Invalid to" }, 400, 0);

  const end = dateFromPartsUTC(toParts);
  if (!end) return respond({ error: "Invalid to" }, 400, 0);

  const desired = weekStartsOn === "mon" ? 1 : 0;
  const endDow = end.getUTCDay();
  const endWeekStart = addUtcDays(end, -((endDow - desired + 7) % 7));
  const gridStart = addUtcDays(endWeekStart, -7 * (weeks - 1));
  const from = formatDateUTC(gridStart);
  const to = formatDateParts(toParts);

  const startParts = parseDateParts(from);
  if (!startParts) return respond({ error: "Invalid to" }, 400, 0);

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
  if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

  const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    await resolveUsageFilterRequestContext({
      edgeClient: auth.edgeClient,
      model,
      effectiveDate: to,
    });

  const valuesByDay = new Map();
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
    effectiveDate: to,
    startIso,
    endIso,
    select:
      "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
    onUsageRow: ({ usageRow }) => {
      accumulateHeatmapDayValue({
        valuesByDay,
        dayKey: formatLocalDateKey(usageRow.date, tzContext),
        billable: usageRow.billable,
      });
    },
  });
  rowCount += scannedRows;
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: "usage_heatmap",
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_weeks: weeks,
    range_days: weeks * 7,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
  });

  if (error) return respond({ error: error.message }, 500, queryDurationMs);

  return respond(
    buildUsageHeatmapPayload({
      valuesByDay,
      gridStart,
      end,
      weeks,
      from,
      to,
      weekStartsOn,
      getDayKey: formatDateUTC,
      renderDay: formatDateUTC,
    }),
    200,
    queryDurationMs,
  );
});
