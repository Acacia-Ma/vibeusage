import "../../shared/auth-core.mjs";

import { getAnonKey, getJwtSecret } from "./env.js";
import { createEdgeClient } from "./insforge-client.js";
import { isPublicShareToken, resolvePublicView } from "./public-view.js";

const authCore = globalThis.__vibeusageAuthCore;
if (!authCore) throw new Error("auth core not initialized");

function createUserEdgeClient({ baseUrl, bearer }) {
  return createEdgeClient({
    baseUrl,
    anonKey: getAnonKey() || undefined,
    edgeFunctionToken: bearer,
  });
}

export const getBearerToken = authCore.getBearerToken;
export const isProjectAdminBearer = authCore.isProjectAdminBearer;
export const verifyUserJwtHs256 = ({ token }) =>
  authCore.verifyUserJwtHs256({ token, jwtSecret: getJwtSecret() });
export const getEdgeClientAndUserIdFast = ({ baseUrl, bearer }) =>
  authCore.getEdgeClientAndUserIdFast({
    baseUrl,
    bearer,
    jwtSecret: getJwtSecret(),
    createUserEdgeClient,
  });
export const getEdgeClientAndUserId = ({ baseUrl, bearer }) =>
  authCore.getEdgeClientAndUserId({
    baseUrl,
    bearer,
    jwtSecret: getJwtSecret(),
    createUserEdgeClient,
  });
export const getAccessContext = ({ baseUrl, bearer, allowPublic = false }) =>
  authCore.getAccessContext({
    baseUrl,
    bearer,
    allowPublic,
    jwtSecret: getJwtSecret(),
    createUserEdgeClient,
    isPublicShareToken,
    resolvePublicView,
  });
