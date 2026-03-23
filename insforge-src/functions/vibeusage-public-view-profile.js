// Edge function: vibeusage-public-view-profile
// Returns a privacy-safe display name for a public share token.

"use strict";

const { handleOptions, json, requireMethod } = require("../shared/http");
const { getBearerToken } = require("../shared/auth");
const { resolvePublicView } = require("../shared/public-view");
const { getBaseUrl } = require("../shared/env");
const { withRequestLogging } = require("../shared/logging");
const { resolveUserIdentity } = require("../shared/user-identity");

module.exports = withRequestLogging("vibeusage-public-view-profile", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const baseUrl = getBaseUrl();
  const publicView = await resolvePublicView({ baseUrl, shareToken: bearer });
  if (!publicView.ok) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await publicView.edgeClient.database
    .from("users")
    .select("nickname,avatar_url,profile,metadata")
    .eq("id", publicView.userId)
    .maybeSingle();

  if (error) return json({ error: "Failed to fetch public profile" }, 500);

  const { displayName, avatarUrl } = resolveUserIdentity(data);
  return json({ display_name: displayName, avatar_url: avatarUrl }, 200);
});
