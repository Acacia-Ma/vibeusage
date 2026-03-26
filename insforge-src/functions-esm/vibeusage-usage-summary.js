import { DETAILED_HOURLY_USAGE_SELECT, forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
import {
  finishAggregateUsageRequest,
  startAggregateUsageRequest,
} from "./shared/core/usage-aggregate.js";
import { buildSlowQueryDebugPayload, isDebugEnabled } from "./shared/debug.js";
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
import { withRequestLogging } from "./shared/logging.js";
import "../shared/usage-pricing-core.mjs";

const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const {
  createRollingUsageState,
  accumulateRollingUsageRow,
  buildRollingUsagePayload,
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

  const aggregateExecution = await startAggregateUsageRequest({
    url,
    tzContext,
    edgeClient: auth.edgeClient,
    auth,
    defaultModel: DEFAULT_MODEL,
    defaultSource: DEFAULT_SOURCE,
    preferRollup: true,
  });
  if (!aggregateExecution.ok) {
    if (aggregateExecution.kind === "request") {
      return respondUsageRequestError(respond, aggregateExecution.result);
    }
    return respond({ error: aggregateExecution.error.message }, 500, Date.now() - aggregateExecution.queryStartMs);
  }
  const { requestContext, aggregateState, queryStartMs, rowCount, rollupHit, rollupDebug } =
    aggregateExecution;
  const { source, from, to, canonicalModel, usageModels, hasModelFilter, aliasTimeline } = requestContext;

  const sumHourlyRangeInto = async (rangeStartIso, rangeEndIso, onRow) => {
    const { error } = await forEachHourlyUsagePage({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      usageModels,
      canonicalModel,
      startIso: rangeStartIso,
      endIso: rangeEndIso,
      select: DETAILED_HOURLY_USAGE_SELECT,
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

  const { aggregatePayload, queryDurationMs } = await finishAggregateUsageRequest({
    edgeClient: auth.edgeClient,
    requestContext,
    aggregateState,
    tzContext,
    logger,
    queryLabel: "usage_summary",
    queryStartMs,
    rowCount,
    defaultModel: DEFAULT_MODEL,
    rollupHit,
  });

  const responsePayload = {
    from,
    to,
    days: requestContext.dayKeys.length,
    ...aggregatePayload.selection,
    ...aggregatePayload.summary,
  };
  if (rollingPayload) responsePayload.rolling = rollingPayload;
  if (isDebugEnabled(url)) {
    responsePayload.debug = {
      ...buildSlowQueryDebugPayload({
        logger,
        durationMs: queryDurationMs,
        status: 200,
      }),
      rollup_enabled: Boolean(rollupDebug?.enabled),
      rollup_hit: Boolean(rollupHit),
      rollup_fallback_reason: rollupDebug?.fallbackReason ?? null,
    };
  }
  return respond(responsePayload, 200, queryDurationMs);
});
