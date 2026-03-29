'use strict';

require("./public-sharing-core");

const { sha256Hex } = require("./crypto");
const publicSharingCore = globalThis.__vibeusagePublicSharingCore;
if (!publicSharingCore) throw new Error("public sharing core not initialized");

module.exports = {
  buildPublicShareToken: publicSharingCore.buildPublicShareToken,
  getPublicVisibilityState: publicSharingCore.getPublicVisibilityState,
  setPublicVisibilityState: ({ edgeClient, userId, enabled, nowIso }) =>
    publicSharingCore.setPublicVisibilityState({
      edgeClient,
      userId,
      enabled,
      nowIso,
      sha256Hex,
    }),
};
