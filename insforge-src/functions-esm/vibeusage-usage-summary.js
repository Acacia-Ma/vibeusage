import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
import { shouldIncludeUsageRow } from "./shared/core/usage-filter.js";
import {
  addDatePartsDays,
  formatDateParts,
  getLocalParts,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts,
  resolveUsageDateRangeLocal,
} from "./shared/date.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { getSourceParam } from "./shared/source.js";
import "../shared/usage-pricing-core.mjs";
import { getModelParam, resolveUsageFilterContext } from "./shared/usage-summary-support.js";

const DEFAULT_SOURCE = "codex";
const DEFAULT_MODEL = "unknown";
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
if (!usagePricingCore) throw new Error("usage pricing core not initialized");
const {
  createAggregateUsageState,
  accumulateAggregateUsageRow,
  createRollingUsageState,
  accumulateRollingUsageRow,
  buildRollingUsagePayload,
  buildAggregateUsagePayload,
  resolveAggregateUsagePricing,
} = usagePricingCore;

export default withRequestLogging("vibeusage-usage-summary", async function (request, logger) {
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
  const rollingEnabled = url.searchParams.get("rolling") === "1";
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;
  const hasModelParam = model != null;
  const range = resolveUsageDateRangeLocal({
    fromRaw: url.searchParams.get("from"),
    toRaw: url.searchParams.get("to"),
    tzContext,
  });
  if (!range.ok) return respond({ error: range.error }, 400, 0);
  const { from, to, dayKeys, startIso, endIso } = range;

  const auth = await getAccessContext({
    baseUrl: getBaseUrl(),
    bearer,
    allowPublic: true,
  });
  if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

  const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    await resolveUsageFilterContext({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: to,
    });

  const aggregateState = createAggregateUsageState({
    hasModelParam,
    defaultModel: DEFAULT_MODEL,
  });

  const queryStartMs = Date.now();
  let rowCount = 0;

  const ingestRow = (row) => {
    if (!shouldIncludeUsageRow({ row, canonicalModel, hasModelFilter, aliasTimeline, to })) return;
    accumulateAggregateUsageRow({
      state: aggregateState,
      row,
      effectiveDate: to,
      defaultSource: DEFAULT_SOURCE,
    });
  };

  const sumHourlyRange = async (rangeStartIso, rangeEndIso) => {
    const { error, rowCount: scannedRows } = await forEachHourlyUsagePage({
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
        for (const row of rows) ingestRow(row);
      },
    });
    rowCount += scannedRows;
    if (error) return { ok: false, error };
    return { ok: true };
  };

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

  const hourlyRes = await sumHourlyRange(startIso, endIso);
  if (!hourlyRes.ok) return respond({ error: hourlyRes.error.message }, 500, Date.now() - queryStartMs);

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

  const pricingSummary = await resolveAggregateUsagePricing({
    edgeClient: auth.edgeClient,
    canonicalModel,
    distinctModels: aggregateState.distinctModels,
    distinctUsageModels: aggregateState.distinctUsageModels,
    pricingBuckets: aggregateState.pricingBuckets,
    effectiveDate: to,
    sourcesMap: aggregateState.sourcesMap,
    totals: aggregateState.totals,
    defaultModel: DEFAULT_MODEL,
  });
  const aggregatePayload = buildAggregateUsagePayload({
    totals: aggregateState.totals,
    pricingSummary,
    hasModelParam,
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
