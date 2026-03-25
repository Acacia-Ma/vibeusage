import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
import { initMonthlyBuckets, ingestMonthlyRow } from "./shared/core/usage-monthly.js";
import {
  addDatePartsDays,
  addDatePartsMonths,
  formatDateParts,
  getLocalParts,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts,
} from "./shared/date.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { toPositiveIntOrNull } from "./shared/numbers.js";
import { getSourceParam } from "./shared/source.js";
import {
  getModelParam,
  resolveUsageFilterContext,
} from "./shared/usage-summary-support.js";

const MAX_MONTHS = 24;

export default withRequestLogging("vibeusage-usage-monthly", async function (request, logger) {
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

  const auth = await getAccessContext({ baseUrl: getBaseUrl(), bearer, allowPublic: true });
  if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;

  const monthsRaw = url.searchParams.get("months");
  const monthsParsed = toPositiveIntOrNull(monthsRaw);
  const months = monthsParsed == null ? MAX_MONTHS : monthsParsed;
  if (months < 1 || months > MAX_MONTHS) return respond({ error: "Invalid months" }, 400, 0);

  const toRaw = url.searchParams.get("to");
  const todayParts = getLocalParts(new Date(), tzContext);
  const toParts = toRaw
    ? parseDateParts(toRaw)
    : { year: todayParts.year, month: todayParts.month, day: todayParts.day };
  if (!toParts) return respond({ error: "Invalid to date" }, 400, 0);

  const startMonthParts = addDatePartsMonths(
    { year: toParts.year, month: toParts.month, day: 1 },
    -(months - 1),
  );
  const from = formatDateParts(startMonthParts);
  const to = formatDateParts(toParts);
  if (!from || !to) return respond({ error: "Invalid to date" }, 400, 0);

  const startUtc = localDatePartsToUtc(
    { ...startMonthParts, hour: 0, minute: 0, second: 0 },
    tzContext,
  );
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const { canonicalModel, usageModels, hasModelFilter, aliasTimeline } =
    await resolveUsageFilterContext({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: to,
    });

  const { monthKeys, buckets } = initMonthlyBuckets({ startMonthParts, months });
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
        ingestMonthlyRow({
          buckets,
          row,
          tzContext,
          source,
          canonicalModel,
          hasModelFilter,
          aliasTimeline,
          to,
        });
      }
    },
  });
  rowCount += scannedRows;
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: "usage_monthly",
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_months: months,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
  });

  if (error) return respond({ error: error.message }, 500, queryDurationMs);

  const monthly = monthKeys.map((key) => {
    const bucket = buckets.get(key);
    return {
      month: key,
      total_tokens: bucket.total.toString(),
      billable_total_tokens: bucket.billable.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString(),
    };
  });

  return respond({ from, to, months, data: monthly }, 200, queryDurationMs);
});
