// Edge function: vibeusage-viewer-identity
// Returns the authenticated viewer's privacy-safe display identity.

"use strict";

const { handleOptions, json, requireMethod } = require("../shared/http");
const { getBearerToken, getAccessContext } = require("../shared/auth");
const { getBaseUrl } = require("../shared/env");
const { withRequestLogging } = require("../shared/logging");
const { resolveUserIdentity } = require("../shared/user-identity");

module.exports = withRequestLogging("vibeusage-viewer-identity", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  const baseUrl = getBaseUrl();
  const access = await getAccessContext({ baseUrl, bearer, allowPublic: false });
  if (!access.ok) {
    return json({ error: access.error || "Unauthorized" }, access.status || 401);
  }

  const { data, error } = await access.edgeClient.database
    .from("users")
    .select("nickname,avatar_url,profile,metadata")
    .eq("id", access.userId)
    .maybeSingle();

  if (error) {
    return json({ error: "Failed to fetch viewer identity" }, 500);
  }

  const { displayName, avatarUrl } = resolveUserIdentity(data);
  return json(
    {
      user_id: access.userId,
      display_name: displayName,
      avatar_url: avatarUrl,
    },
    200,
  );
});
