import {
  accumulateHeatmapDayValue,
  buildUsageHeatmapPayload,
  resolveUsageHeatmapRequestContext,
} from "./shared/core/usage-heatmap.js";
import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import {
  resolveUsageFilterRequestSnapshot,
} from "./shared/core/usage-filter-request.js";
import { collectFilteredUsageRows } from "./shared/core/usage-filtered-rows.js";
import {
  formatDateUTC,
  formatLocalDateKey,
  getUsageTimeZoneContext,
} from "./shared/date.js";
import { withRequestLogging } from "./shared/logging.js";

export default withRequestLogging("vibeusage-usage-heatmap", async function (request, logger) {
  const endpoint = prepareUsageEndpoint({ request, logger });
  if (!endpoint.ok) return endpoint.response;
  const { url, respond, bearer } = endpoint;

  const tzContext = getUsageTimeZoneContext(url);
  const requestContext = resolveUsageHeatmapRequestContext({ url, tzContext });
  if (!requestContext.ok) return respondUsageRequestError(respond, requestContext);
  const { timeMode, weeks, weekStartsOn, from, to, gridStart, end, startIso, endIso } =
    requestContext;

  const access = await requireUsageAccess({ respond, bearer });
  if (!access.ok) return access.response;
  const { auth } = access;

  const filterSnapshot = await resolveUsageFilterRequestSnapshot({
    url,
    edgeClient: auth.edgeClient,
    effectiveDate: to,
  });
  if (!filterSnapshot.ok) return respondUsageRequestError(respond, filterSnapshot);
  const { source, canonicalModel, usageModels, hasModelFilter, aliasTimeline } = filterSnapshot;

  const valuesByDay = new Map();
  const { error, queryDurationMs } = await collectFilteredUsageRows({
    logger,
    queryLabel: "usage_heatmap",
    logMeta: {
      range_weeks: weeks,
      range_days: weeks * 7,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    },
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
