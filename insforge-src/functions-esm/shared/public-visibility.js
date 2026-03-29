import "../../shared/public-sharing-core.mjs";

import { sha256Hex } from "./crypto.js";

const publicSharingCore = globalThis.__vibeusagePublicSharingCore;
if (!publicSharingCore) throw new Error("public sharing core not initialized");

export const buildPublicShareToken = publicSharingCore.buildPublicShareToken;
export const getPublicVisibilityState = publicSharingCore.getPublicVisibilityState;
export const setPublicVisibilityState = ({ edgeClient, userId, enabled, nowIso }) =>
  publicSharingCore.setPublicVisibilityState({
    edgeClient,
    userId,
    enabled,
    nowIso,
    sha256Hex,
  });
