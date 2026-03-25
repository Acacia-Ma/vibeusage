import { getAccessContext, getBearerToken } from "./shared/auth.js";
import {
  accumulateHeatmapDayValue,
  buildUsageHeatmapPayload,
  resolveUsageHeatmapRequestContext,
} from "./shared/core/usage-heatmap.js";
import {
  resolveUsageFilterRequestContext,
  resolveUsageFilterRequestParams,
} from "./shared/core/usage-filter-request.js";
import { collectHourlyUsageRows } from "./shared/core/usage-row-collector.js";
import { createUsageJsonResponder } from "./shared/core/usage-response.js";
import {
  formatDateUTC,
  formatLocalDateKey,
  getUsageTimeZoneContext,
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

  const requestContext = resolveUsageHeatmapRequestContext({ url, tzContext });
  if (!requestContext.ok) {
    return respond({ error: requestContext.error }, requestContext.status || 400, 0);
  }
  const { timeMode, weeks, weekStartsOn, from, to, gridStart, end, startIso, endIso } =
    requestContext;

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
        dayKey:
          timeMode === "utc"
            ? formatDateUTC(usageRow.date)
            : formatLocalDateKey(usageRow.date, tzContext),
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
