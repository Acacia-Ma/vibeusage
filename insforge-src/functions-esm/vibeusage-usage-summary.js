import { forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
import { collectAggregateUsageRange } from "./shared/core/usage-aggregate-collector.js";
import { resolveAggregateUsageRequestContext } from "./shared/core/usage-aggregate-request.js";
import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
import {
  addDatePartsDays,
  formatDateParts,
  getLocalParts,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts,
} from "./shared/date.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import "../shared/usage-pricing-core.mjs";

const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const {
  createAggregateUsageState,
  createRollingUsageState,
  accumulateRollingUsageRow,
  buildRollingUsagePayload,
  resolveAggregateUsagePayload,
} = usagePricingCore;

export default withRequestLogging("vibeusage-usage-summary", async function (request, logger) {
  const endpoint = prepareUsageEndpoint({ request, logger });
  if (!endpoint.ok) return endpoint.response;
  const { url, respond, bearer } = endpoint;

  const tzContext = getUsageTimeZoneContext(url);
  const rollingEnabled = url.searchParams.get("rolling") === "1";

  const access = await requireUsageAccess({ respond, bearer });
  if (!access.ok) return access.response;
  const { auth } = access;

  const requestContext = await resolveAggregateUsageRequestContext({
    url,
    tzContext,
    edgeClient: auth.edgeClient,
    auth,
  });
  if (!requestContext.ok) return respondUsageRequestError(respond, requestContext);
  const {
    source,
    hasModelParam,
    from,
    to,
    dayKeys,
    startIso,
    endIso,
    canonicalModel,
    usageModels,
    hasModelFilter,
    aliasTimeline,
  } = requestContext;

  const aggregateState = createAggregateUsageState({
    hasModelParam,
    defaultModel: DEFAULT_MODEL,
  });

  const queryStartMs = Date.now();
  let rowCount = 0;

  const sumHourlyRangeInto = async (rangeStartIso, rangeEndIso, onRow) => {
    const { error } = await forEachHourlyUsagePage({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      usageModels,
      canonicalModel,
      startIso: rangeStartIso,
      endIso: rangeEndIso,
      select:
        "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
      onPage: (rows) => {
        for (const row of rows) onRow(row);
      },
    });
    if (error) return { ok: false, error };
    return { ok: true };
  };

  const buildRollingWindow = async ({ fromDay, toDay }) => {
    const rangeStartParts = parseDateParts(fromDay);
    const rangeEndParts = parseDateParts(toDay);
    if (!rangeStartParts || !rangeEndParts) return { ok: false, error: new Error("Invalid rolling range") };

    const rangeStartUtc = localDatePartsToUtc(rangeStartParts, tzContext);
    const rangeEndUtc = localDatePartsToUtc(addDatePartsDays(rangeEndParts, 1), tzContext);
    if (!Number.isFinite(rangeStartUtc.getTime()) || !Number.isFinite(rangeEndUtc.getTime())) {
      return { ok: false, error: new Error("Invalid rolling range") };
    }

    const rangeStartIso = rangeStartUtc.toISOString();
    const rangeEndIso = rangeEndUtc.toISOString();
    const rollingState = createRollingUsageState();
    const ingestRollingRow = (row) => {
      if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) return;
      accumulateRollingUsageRow({
        state: rollingState,
        row,
        tzContext,
        defaultSource: DEFAULT_SOURCE,
      });
    };

    const sumRes = await sumHourlyRangeInto(rangeStartIso, rangeEndIso, ingestRollingRow);
    if (!sumRes.ok) return sumRes;
    return {
      ok: true,
      payload: buildRollingUsagePayload({ state: rollingState, fromDay, toDay }),
    };
  };

  const aggregateRes = await collectAggregateUsageRange({
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
    state: aggregateState,
    defaultSource: DEFAULT_SOURCE,
  });
  rowCount += aggregateRes.rowCount;
  if (aggregateRes.error) {
    return respond({ error: aggregateRes.error.message }, 500, Date.now() - queryStartMs);
  }

  let rollingPayload = null;
  if (rollingEnabled) {
    const localTodayParts = getLocalParts(new Date(), tzContext);
    const localYesterday = formatDateParts(addDatePartsDays(localTodayParts, -1));
    const rollingToDay = to < localYesterday ? to : localYesterday;
    const rollingEndParts = parseDateParts(rollingToDay);
    if (!rollingEndParts) return respond({ error: "Invalid rolling range" }, 400, 0);
    const last7From = formatDateParts(addDatePartsDays(rollingEndParts, -6));
    const last30From = formatDateParts(addDatePartsDays(rollingEndParts, -29));
    if (!last7From || !last30From) return respond({ error: "Invalid rolling range" }, 400, 0);

    const last7Res = await buildRollingWindow({ fromDay: last7From, toDay: rollingToDay });
    if (!last7Res.ok) return respond({ error: last7Res.error.message }, 500, Date.now() - queryStartMs);
    const last30Res = await buildRollingWindow({ fromDay: last30From, toDay: rollingToDay });
    if (!last30Res.ok) return respond({ error: last30Res.error.message }, 500, Date.now() - queryStartMs);
    rollingPayload = { last_7d: last7Res.payload, last_30d: last30Res.payload };
  }

  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: "usage_summary",
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: false,
  });

  const { aggregatePayload } = await resolveAggregateUsagePayload({
    edgeClient: auth.edgeClient,
    canonicalModel,
    effectiveDate: to,
    state: aggregateState,
    hasModelParam,
    defaultModel: DEFAULT_MODEL,
  });

  const responsePayload = {
    from,
    to,
    days: dayKeys.length,
    ...aggregatePayload.selection,
    ...aggregatePayload.summary,
  };
  if (rollingPayload) responsePayload.rolling = rollingPayload;
  return respond(responsePayload, 200, queryDurationMs);
});
