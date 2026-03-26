import { handleOptions, json } from "./shared/http.js";
import { withRequestLogging } from "./shared/logging.js";

export default withRequestLogging("vibeusage-leaderboard-settings", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;
  return json({ error: "Endpoint retired" }, 410);
});
