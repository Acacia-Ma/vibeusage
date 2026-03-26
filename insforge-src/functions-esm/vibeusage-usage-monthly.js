import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import {
  resolveUsageFilterRequestSnapshot,
} from "./shared/core/usage-filter-request.js";
import { DETAILED_HOURLY_USAGE_SELECT, forEachHourlyUsagePage } from "./shared/db/usage-hourly.js";
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
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import { toPositiveIntOrNull } from "./shared/numbers.js";
import "../shared/usage-metrics-core.mjs";

const MAX_MONTHS = 24;
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
if (!usageMetricsCore) throw new Error("usage metrics core not initialized");

export default withRequestLogging("vibeusage-usage-monthly", async function (request, logger) {
  const endpoint = prepareUsageEndpoint({ request, logger });
  if (!endpoint.ok) return endpoint.response;
  const { url, respond, bearer } = endpoint;

  const access = await requireUsageAccess({ respond, bearer });
  if (!access.ok) return access.response;
  const { auth } = access;

  const tzContext = getUsageTimeZoneContext(url);

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

  const filterSnapshot = await resolveUsageFilterRequestSnapshot({
    url,
    edgeClient: auth.edgeClient,
    effectiveDate: to,
  });
  if (!filterSnapshot.ok) return respondUsageRequestError(respond, filterSnapshot);
  const { source, canonicalModel, usageModels, hasModelFilter, aliasTimeline } = filterSnapshot;

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
    select: DETAILED_HOURLY_USAGE_SELECT,
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
      ...usageMetricsCore.buildUsageBucketPayload(bucket),
    };
  });

  return respond({ from, to, months, data: monthly }, 200, queryDurationMs);
});
