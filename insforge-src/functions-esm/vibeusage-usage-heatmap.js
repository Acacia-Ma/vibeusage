import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
import { buildUsageHeatmapPayload } from "./shared/core/usage-heatmap.js";
import { forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
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
  parseUtcDateString,
} from "./shared/date.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { getSourceParam } from "./shared/source.js";
import {
  getModelParam,
  resolveHourlyUsageRowState,
  resolveUsageFilterContext,
} from "./shared/usage-summary-support.js";

export default withRequestLogging("vibeusage-usage-heatmap", async function (request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const url = new URL(request.url);
  const debugEnabled = isDebugEnabled(url);
  const respond = (body, status, durationMs) =>
    json(
      debugEnabled ? withSlowQueryDebugPayload(body, { logger, durationMs, status }) : body,
      status,
    );

  if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;

  const weeksRaw = url.searchParams.get("weeks");
  const weeks = normalizeWeeks(weeksRaw);
  if (!weeks) return respond({ error: "Invalid weeks" }, 400, 0);

  const weekStartsOnRaw = url.searchParams.get("week_starts_on");
  const weekStartsOn = normalizeWeekStartsOn(weekStartsOnRaw);
  if (!weekStartsOn) return respond({ error: "Invalid week_starts_on" }, 400, 0);

  const toRaw = url.searchParams.get("to");

  if (isUtcTimeZone(tzContext)) {
    const to = normalizeToDate(toRaw);
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
      await resolveUsageFilterContext({
        edgeClient: auth.edgeClient,
        canonicalModel: model,
        effectiveDate: to,
      });

    const valuesByDay = new Map();
    const queryStartMs = Date.now();
    let rowCount = 0;
    const { error, rowCount: scannedRows } = await forEachHourlyUsagePage({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      usageModels,
      canonicalModel,
      startIso,
      endIso,
      select:
        "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
      onPage: (rows) => {
        for (const row of rows) {
          const usageRow = resolveHourlyUsageRowState({
            row,
            source,
            effectiveDate: to,
          });
          if (!usageRow) continue;
          if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) continue;
          const day = formatDateUTC(usageRow.date);
          const prev = valuesByDay.get(day) || 0n;
          valuesByDay.set(day, prev + usageRow.billable);
        }
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
    await resolveUsageFilterContext({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: to,
    });

  const valuesByDay = new Map();
  const queryStartMs = Date.now();
  let rowCount = 0;
  const { error, rowCount: scannedRows } = await forEachHourlyUsagePage({
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    source,
    usageModels,
    canonicalModel,
    startIso,
    endIso,
    select:
      "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
    onPage: (rows) => {
      for (const row of rows) {
        const usageRow = resolveHourlyUsageRowState({
          row,
          source,
          effectiveDate: to,
        });
        if (!usageRow) continue;
        if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) continue;
        const key = formatLocalDateKey(usageRow.date, tzContext);
        const prev = valuesByDay.get(key) || 0n;
        valuesByDay.set(key, prev + usageRow.billable);
      }
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

function normalizeWeeks(raw) {
  if (raw == null || raw === "") return 52;
  const value = String(raw).trim();
  if (!/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 104) return null;
  return parsed;
}

function normalizeWeekStartsOn(raw) {
  const value = (raw == null || raw === "" ? "sun" : String(raw)).trim().toLowerCase();
  if (value === "sun" || value === "mon") return value;
  return null;
}

function normalizeToDate(raw) {
  if (raw == null || raw === "") return formatDateUTC(new Date());
  const value = String(raw).trim();
  const dt = parseUtcDateString(value);
  return dt ? formatDateUTC(dt) : null;
}
