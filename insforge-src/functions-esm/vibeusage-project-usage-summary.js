import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { isCanaryTag } from "./shared/canary.js";
import { isDebugEnabled, withSlowQueryDebugPayload } from "./shared/debug.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { logSlowQuery, withRequestLogging } from "./shared/logging.js";
import {
  aggregateProjectUsageRows,
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
    const debugEnabled = isDebugEnabled(url);
    const respond = (body, status, durationMs) =>
      json(
        debugEnabled ? withSlowQueryDebugPayload(body, { logger, durationMs, status }) : body,
        status,
      );

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

    let query = auth.edgeClient.database
      .from("vibeusage_project_usage_hourly")
      .select(
        "project_key,project_ref,sum_total_tokens:sum(total_tokens),sum_billable_total_tokens:sum(billable_total_tokens)",
      )
      .eq("user_id", auth.userId);
    if (source) query = query.eq("source", source);
    if (!isCanaryTag(source)) query = query.neq("source", "canary");
    query = query
      .order("sum_billable_total_tokens", { ascending: false })
      .order("sum_total_tokens", { ascending: false })
      .limit(limit);

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
    let query = edgeClient.database
      .from("vibeusage_project_usage_hourly")
      .select("project_key,project_ref,total_tokens,billable_total_tokens")
      .eq("user_id", userId);
    if (source) query = query.eq("source", source);
    if (!isCanaryTag(source)) query = query.neq("source", "canary");
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, entries: aggregateProjectUsageRows(data, limit) };
  } catch (error) {
    return { ok: false, error: error?.message || "Fallback query failed" };
  }
}
