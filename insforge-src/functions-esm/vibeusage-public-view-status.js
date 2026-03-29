import { getBearerToken, getEdgeClientAndUserId } from "./shared/auth.js";
import { getBaseUrl } from "./shared/env.js";
import { handleOptions, json } from "./shared/http.js";
import { withRequestLogging } from "./shared/logging.js";

export default withRequestLogging("vibeusage-public-view-status", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const auth = await getEdgeClientAndUserId({ baseUrl: getBaseUrl(), bearer });
  if (!auth.ok) return json({ error: auth.error || "Unauthorized" }, auth.status || 401);

  const { data: settings, error: settingsErr } = await auth.edgeClient.database
    .from("vibeusage_user_settings")
    .select("leaderboard_public")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (settingsErr) return json({ error: "Failed to fetch public view status" }, 500);
  if (settings?.leaderboard_public !== true) return json({ enabled: false }, 200);

  const { data, error } = await auth.edgeClient.database
    .from("vibeusage_public_views")
    .select("revoked_at")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) return json({ error: "Failed to fetch public view status" }, 500);
  return json({ enabled: Boolean(data && !data.revoked_at) }, 200);
});
