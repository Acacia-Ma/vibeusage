import { getAccessContext, getBearerToken } from "./shared/auth.js";
import "./shared/date.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, requireMethod } from "./shared/http.js";
import { createEdgeClient } from "./shared/insforge-client.js";
import { toBigInt, toPositiveInt, toPositiveIntOrNull } from "./shared/numbers.js";
import "../shared/user-identity-core.mjs";
import "../shared/leaderboard-core.mjs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10_000;
const leaderboardCore = globalThis.__vibeusageLeaderboardCore;
if (!leaderboardCore) throw new Error("leaderboard core not initialized");
const {
  normalizeLeaderboardPeriod,
  computeLeaderboardWindow,
  resolveLeaderboardOtherTokens,
  normalizeLeaderboardDisplayName,
  normalizeLeaderboardAvatarUrl,
  normalizeLeaderboardGeneratedAt,
} = leaderboardCore;

export default async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  const baseUrl = getBaseUrl();

  let auth = { ok: false, edgeClient: null, userId: null };
  if (bearer) {
    auth = await getAccessContext({ baseUrl, bearer, allowPublic: false });
    if (!auth.ok) return json({ error: auth.error || "Unauthorized" }, auth.status || 401);
  }

  const viewerUserId = auth.ok ? auth.userId : null;
  const url = new URL(request.url);
  const period = normalizeLeaderboardPeriod(url.searchParams.get("period"));
  if (!period) return json({ error: "Invalid period" }, 400);

  const metric = normalizeMetric(url.searchParams.get("metric"));
  if (url.searchParams.has("metric") && !metric) return json({ error: "Invalid metric" }, 400);

  const limit = normalizeLimit(url.searchParams.get("limit"));
  const offset = normalizeOffset(url.searchParams.get("offset"));
  const page = Math.floor(offset / Math.max(1, limit)) + 1;

  let from;
  let to;
  try {
    ({ from, to } = computeLeaderboardWindow({ period }));
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }

  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const serviceClient = serviceRoleKey
    ? await createEdgeClient({
        baseUrl,
        anonKey: anonKey || serviceRoleKey,
        edgeFunctionToken: serviceRoleKey,
      })
    : null;

  if (!serviceClient) {
    return snapshotUnavailableResponse({ period, metric, from, to });
  }

  const snapshot = await loadSnapshot({
    serviceClient,
    period,
    metric,
    from,
    to,
    userId: viewerUserId,
    limit,
    offset,
  });
  if (!snapshot.ok) {
    return snapshotUnavailableResponse({ period, metric, from, to });
  }

  return json(
    {
      period,
      metric,
      from,
      to,
      generated_at: snapshot.generated_at,
      page,
      limit,
      offset,
      total_entries: snapshot.total_entries,
      total_pages: snapshot.total_pages,
      entries: snapshot.entries,
      me: snapshot.me,
    },
    200,
  );
}

function toSafeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeMetric(raw) {
  if (typeof raw !== "string") return "all";
  const value = raw.trim().toLowerCase();
  if (!value) return "all";
  if (value === "all" || value === "gpt" || value === "claude" || value === "other") return value;
  return null;
}

function normalizeLimit(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_LIMIT;
  const i = Math.floor(Number(raw));
  if (!Number.isFinite(i)) return DEFAULT_LIMIT;
  if (i < 1) return 1;
  if (i > MAX_LIMIT) return MAX_LIMIT;
  return i;
}

function normalizeOffset(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_OFFSET;
  const i = Math.floor(Number(raw));
  if (!Number.isFinite(i)) return DEFAULT_OFFSET;
  if (i < 0) return 0;
  if (i > MAX_OFFSET) return MAX_OFFSET;
  return i;
}

function applyMetricFilter(query, metric) {
  if (!query) return query;
  if (metric === "gpt") return query.gt("gpt_tokens", 0);
  if (metric === "claude") return query.gt("claude_tokens", 0);
  if (metric === "other") return query.gt("other_tokens", 0);
  return query;
}

function resolveRankColumn(metric) {
  if (metric === "gpt") return "rank_gpt";
  if (metric === "claude") return "rank_claude";
  if (metric === "other") return "rank_other";
  return "rank";
}

async function loadSnapshot({ serviceClient, period, metric, from, to, userId, limit, offset }) {
  const rankColumn = resolveRankColumn(metric);
  const countQuery = applyMetricFilter(
    serviceClient.database
      .from("vibeusage_leaderboard_snapshots")
      .select("user_id", { count: "exact" })
      .eq("period", period)
      .eq("from_day", from)
      .eq("to_day", to),
    metric,
  );
  const countRes = await countQuery.limit(1);
  if (countRes.error) return { ok: false };

  const totalEntries = toSafeCount(countRes.count);
  const totalPages = totalEntries > 0 ? Math.ceil(totalEntries / Math.max(1, limit)) : 0;

  const entriesQuery = applyMetricFilter(
    serviceClient.database
      .from("vibeusage_leaderboard_snapshots")
      .select(
        "user_id,rank,rank_gpt,rank_claude,rank_other,gpt_tokens,claude_tokens,other_tokens,total_tokens,display_name,avatar_url,is_public,generated_at",
      )
      .eq("period", period)
      .eq("from_day", from)
      .eq("to_day", to),
    metric,
  );
  const { data: entryRows, error: entriesErr } = await entriesQuery
    .order(rankColumn, { ascending: true })
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (entriesErr) return { ok: false };

  const publicUserSet = await loadActivePublicUserIds({ serviceClient, rows: entryRows });
  let meRow = null;
  if (userId) {
    const meRes = await serviceClient.database
      .from("vibeusage_leaderboard_snapshots")
      .select(
        "rank,rank_gpt,rank_claude,rank_other,gpt_tokens,claude_tokens,other_tokens,total_tokens,generated_at",
      )
      .eq("period", period)
      .eq("from_day", from)
      .eq("to_day", to)
      .eq("user_id", userId)
      .maybeSingle();
    if (meRes.error) return { ok: false };
    meRow = meRes.data;
  }

  const entries = (entryRows || []).map((row) => {
    const metricRank = toPositiveInt(row?.[rankColumn]);
    const resolvedRank = metricRank > 0 ? metricRank : toPositiveInt(row?.rank);
    const normalized = normalizeEntry(row, { userId, publicUserSet });
    return { ...normalized, rank: resolvedRank };
  });
  const me = userId ? normalizeMetricMe(meRow, metric) : null;
  const generatedAt = resolveGeneratedAt(entryRows, meRow);
  if (entries.length === 0 && !meRow) return { ok: false };
  return {
    ok: true,
    total_entries: totalEntries,
    total_pages: totalPages,
    entries,
    me,
    generated_at: generatedAt,
  };
}

function normalizeMetricMe(row, metric) {
  const gptTokens = toBigInt(row?.gpt_tokens);
  const claudeTokens = toBigInt(row?.claude_tokens);
  const totalTokens = toBigInt(row?.total_tokens);
  const otherTokens = resolveLeaderboardOtherTokens({ row, totalTokens, gptTokens, claudeTokens });
  let rank = toPositiveIntOrNull(row?.rank);
  if (metric === "gpt") {
    rank = gptTokens > 0n ? toPositiveIntOrNull(row?.rank_gpt) : null;
  } else if (metric === "claude") {
    rank = claudeTokens > 0n ? toPositiveIntOrNull(row?.rank_claude) : null;
  } else if (metric === "other") {
    const rankOther = toPositiveIntOrNull(row?.rank_other);
    rank = otherTokens > 0n ? (rankOther ?? toPositiveIntOrNull(row?.rank)) : null;
  }
  return {
    rank,
    gpt_tokens: gptTokens.toString(),
    claude_tokens: claudeTokens.toString(),
    other_tokens: otherTokens.toString(),
    total_tokens: totalTokens.toString(),
  };
}

function normalizeEntry(row, options = {}) {
  const userId = typeof options?.userId === "string" ? options.userId : null;
  const publicUserSet = options?.publicUserSet;
  const gptTokens = toBigInt(row?.gpt_tokens);
  const claudeTokens = toBigInt(row?.claude_tokens);
  const totalTokens = toBigInt(row?.total_tokens);
  const otherTokens = resolveLeaderboardOtherTokens({ row, totalTokens, gptTokens, claudeTokens });
  const rawUserId = typeof row?.user_id === "string" ? row.user_id : null;
  const isPublic = resolveIsPublic({ rawUserId, publicUserSet });
  const isMe = userId ? (rawUserId ? rawUserId === userId : Boolean(row?.is_me)) : false;
  return {
    user_id: isPublic ? rawUserId : null,
    rank: toPositiveInt(row?.rank),
    is_me: isMe,
    display_name: isPublic ? normalizeLeaderboardDisplayName(row?.display_name) : "Anonymous",
    avatar_url: isPublic ? normalizeLeaderboardAvatarUrl(row?.avatar_url) : null,
    gpt_tokens: gptTokens.toString(),
    claude_tokens: claudeTokens.toString(),
    other_tokens: otherTokens.toString(),
    total_tokens: totalTokens.toString(),
    is_public: isPublic,
  };
}

function resolveIsPublic({ rawUserId, publicUserSet }) {
  if (!(publicUserSet instanceof Set) || !rawUserId) return false;
  return publicUserSet.has(rawUserId);
}

async function loadActivePublicUserIds({ serviceClient, rows }) {
  if (!serviceClient) return null;
  if (!Array.isArray(rows) || rows.length === 0) return new Set();
  const ids = [
    ...new Set(
      rows
        .map((row) => (typeof row?.user_id === "string" ? row.user_id : null))
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return new Set();
  const { data, error } = await serviceClient.database
    .from("vibeusage_public_views")
    .select("user_id")
    .in("user_id", ids)
    .is("revoked_at", null);
  if (error) return null;
  return new Set((data || []).map((row) => row?.user_id).filter(Boolean));
}

function resolveGeneratedAt(entryRows, meRow) {
  const candidate = entryRows?.[0]?.generated_at || meRow?.generated_at;
  return normalizeLeaderboardGeneratedAt(candidate);
}

function snapshotUnavailableResponse({ period, metric, from, to }) {
  return json(
    {
      error: "Leaderboard snapshot unavailable",
      snapshot_status: "unavailable",
      period,
      metric,
      from,
      to,
    },
    503,
  );
}
