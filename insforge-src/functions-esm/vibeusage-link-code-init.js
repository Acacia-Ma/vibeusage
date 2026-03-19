import { getBearerToken, getEdgeClientAndUserId } from "./shared/auth.js";
import { createEdgeClient } from "./shared/insforge-client.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, readJson, requireMethod } from "./shared/http.js";
import { sha256Hex } from "./shared/crypto.js";
import { withRequestLogging } from "./shared/logging.js";

const LINK_CODE_TTL_MS = 10 * 60_000;

export default withRequestLogging("vibeusage-link-code-init", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: auth.error || "Unauthorized" }, auth.status || 401);

  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const dbClient = serviceRoleKey
    ? await createEdgeClient({
        baseUrl,
        anonKey: anonKey || serviceRoleKey,
        edgeFunctionToken: serviceRoleKey,
      })
    : auth.edgeClient;

  const linkCode = generateLinkCode();
  const codeHash = await sha256Hex(linkCode);
  const sessionId = await sha256Hex(bearer);
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();

  const { error: insertErr } = await dbClient.database.from("vibeusage_link_codes").insert([
    {
      user_id: auth.userId,
      code_hash: codeHash,
      session_id: sessionId,
      expires_at: expiresAt,
      used_at: null,
      request_id: null,
    },
  ]);

  if (insertErr) {
    return json({ error: "Failed to issue link code" }, 500);
  }

  return json({ link_code: linkCode, expires_at: expiresAt }, 200);
});

function generateLinkCode() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
