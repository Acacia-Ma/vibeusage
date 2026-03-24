import { getAccessContext, getBearerToken } from "./shared/auth.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json, requireMethod } from "./shared/http.js";
import { withRequestLogging } from "./shared/logging.js";
import { resolveUserIdentity } from "./shared/user-identity.js";

export default withRequestLogging("vibeusage-viewer-identity", async function (request) {
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
