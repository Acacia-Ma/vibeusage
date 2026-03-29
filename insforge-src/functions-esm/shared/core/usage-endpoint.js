import { getAccessContext, getBearerToken } from "../auth.js";
import { createUsageJsonResponder } from "./usage-response.js";
import { getBaseUrl } from "../env.js";
import { handleOptions } from "../http.js";

export function prepareUsageEndpoint({ request, logger, method = "GET" }) {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return { ok: false, response: optionsResponse };

  const url = new URL(request.url);
  const respond = createUsageJsonResponder({ url, logger });

  if (request.method !== method) {
    return {
      ok: false,
      response: respond({ error: "Method not allowed" }, 405, 0),
    };
  }

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) {
    return {
      ok: false,
      response: respond({ error: "Missing bearer token" }, 401, 0),
    };
  }

  return { ok: true, url, respond, bearer };
}

export async function requireUsageAccess({ respond, bearer, allowPublic = true }) {
  const auth = await getAccessContext({
    baseUrl: getBaseUrl(),
    bearer,
    allowPublic,
  });
  if (!auth.ok) {
    return {
      ok: false,
      response: respond({ error: auth.error || "Unauthorized" }, auth.status || 401, 0),
    };
  }
  return { ok: true, auth };
}

export function respondUsageRequestError(respond, result) {
  return respond({ error: result?.error || "Invalid request" }, result?.status || 400, 0);
}
