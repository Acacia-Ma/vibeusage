import {
  prepareUsageEndpoint,
  requireUsageAccess,
  respondUsageRequestError,
} from "./shared/core/usage-endpoint.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import {
  aggregateProjectUsageRows,
  buildProjectUsageAggregateQuery,
  buildProjectUsageFallbackQuery,
  normalizeProjectUsageLimit,
  normalizeProjectUsageRows,
  shouldFallbackProjectUsageAggregate,
} from "./shared/project-usage.js";
import { getSourceParam } from "./shared/source.js";

export default withRequestLogging(
  "vibeusage-project-usage-summary",
  async function (request, logger) {
    const endpoint = prepareUsageEndpoint({ request, logger });
    if (!endpoint.ok) return endpoint.response;
    const { url, respond, bearer } = endpoint;

    const access = await requireUsageAccess({ respond, bearer });
    if (!access.ok) return access.response;
    const { auth } = access;

    const sourceResult = getSourceParam(url);
    if (!sourceResult.ok) return respondUsageRequestError(respond, sourceResult);
    const source = sourceResult.source;
    const from = null;
    const to = null;
    const limit = normalizeProjectUsageLimit(url.searchParams.get("limit"));
    const queryStartMs = Date.now();

    const query = buildProjectUsageAggregateQuery({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      source,
      limit,
    });

    const { data, error } = await query;
    let entries = null;
    if (error && shouldFallbackProjectUsageAggregate(error?.message)) {
      const fallback = await fetchProjectUsageFallback({
        edgeClient: auth.edgeClient,
        userId: auth.userId,
        source,
        limit,
      });
      if (!fallback.ok) {
        const queryDurationMs = Date.now() - queryStartMs;
        return respond({ error: fallback.error }, 500, queryDurationMs);
      }
      entries = fallback.entries;
    } else if (error) {
      const queryDurationMs = Date.now() - queryStartMs;
      return respond({ error: error.message }, 500, queryDurationMs);
    } else {
      entries = normalizeProjectUsageRows(data);
    }

    const queryDurationMs = Date.now() - queryStartMs;
    logSlowQuery(logger, {
      query_label: "project_usage_summary",
      duration_ms: queryDurationMs,
      row_count: entries.length,
      range_days: null,
      source: source || null,
      tz: null,
      tz_offset_minutes: null,
    });

    return respond(
      {
        from,
        to,
        all_time: true,
        generated_at: new Date().toISOString(),
        entries: entries || [],
      },
      200,
      queryDurationMs,
    );
  },
);

async function fetchProjectUsageFallback({ edgeClient, userId, source, limit }) {
  try {
    const query = buildProjectUsageFallbackQuery({ edgeClient, userId, source });
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, entries: aggregateProjectUsageRows(data, limit) };
  } catch (error) {
    return { ok: false, error: error?.message || "Fallback query failed" };
  }
}
