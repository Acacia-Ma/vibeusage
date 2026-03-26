"use strict";

require("./public-sharing-core");

const { getAnonKey, getServiceRoleKey } = require("./env");
const publicSharingCore = globalThis.__vibeusagePublicSharingCore;
if (!publicSharingCore) throw new Error("public sharing core not initialized");

async function resolvePublicView({ baseUrl, shareToken }) {
  return publicSharingCore.resolvePublicView({
    baseUrl,
    shareToken,
    anonKey: getAnonKey(),
    serviceRoleKey: getServiceRoleKey(),
    createServiceClient: ({ baseUrl, anonKey, edgeFunctionToken }) =>
      createClient({
        baseUrl,
        anonKey,
        edgeFunctionToken,
      }),
  });
}

module.exports = {
  resolvePublicView,
  isPublicShareToken: publicSharingCore.isPublicShareToken,
};
