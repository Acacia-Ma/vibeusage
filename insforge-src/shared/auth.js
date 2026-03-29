"use strict";

require("./auth-core");

const { getAnonKey, getJwtSecret } = require("./env");
const { resolvePublicView, isPublicShareToken } = require("./public-view");
const authCore = globalThis.__vibeusageAuthCore;
if (!authCore) throw new Error("auth core not initialized");

module.exports = {
  getBearerToken: authCore.getBearerToken,
  getAccessContext: ({ baseUrl, bearer, allowPublic = false }) =>
    authCore.getAccessContext({
      baseUrl,
      bearer,
      allowPublic,
      jwtSecret: getJwtSecret(),
      createUserEdgeClient: ({ baseUrl, bearer }) =>
        createClient({
          baseUrl,
          anonKey: getAnonKey() || undefined,
          edgeFunctionToken: bearer,
        }),
      isPublicShareToken,
      resolvePublicView,
    }),
  getEdgeClientAndUserId: ({ baseUrl, bearer }) =>
    authCore.getEdgeClientAndUserId({
      baseUrl,
      bearer,
      jwtSecret: getJwtSecret(),
      createUserEdgeClient: ({ baseUrl, bearer }) =>
        createClient({
          baseUrl,
          anonKey: getAnonKey() || undefined,
          edgeFunctionToken: bearer,
        }),
    }),
  getEdgeClientAndUserIdFast: ({ baseUrl, bearer }) =>
    authCore.getEdgeClientAndUserIdFast({
      baseUrl,
      bearer,
      jwtSecret: getJwtSecret(),
      createUserEdgeClient: ({ baseUrl, bearer }) =>
        createClient({
          baseUrl,
          anonKey: getAnonKey() || undefined,
          edgeFunctionToken: bearer,
        }),
    }),
  isProjectAdminBearer: authCore.isProjectAdminBearer,
  verifyUserJwtHs256: ({ token }) =>
    authCore.verifyUserJwtHs256({ token, jwtSecret: getJwtSecret() }),
};
