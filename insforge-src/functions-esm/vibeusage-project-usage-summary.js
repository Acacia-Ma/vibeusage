import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { createUsageJsonResponder } from "./shared/core/usage-response.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions } from "./shared/http.js";
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
    const opt = handleOptions(request);
    if (opt) return opt;

    const url = new URL(request.url);
    const respond = createUsageJsonResponder({ url, logger });

    if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405, 0);

    const bearer = getBearerToken(request.headers.get("Authorization"));
    if (!bearer) return respond({ error: "Missing bearer token" }, 401, 0);

    const auth = await getAccessContext({
      baseUrl: getBaseUrl(),
      bearer,
      allowPublic: true,
    });
    if (!auth.ok) return respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0);

    const sourceResult = getSourceParam(url);
    if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
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
