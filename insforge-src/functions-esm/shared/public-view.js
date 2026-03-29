import "../../shared/public-sharing-core.mjs";

import { getAnonKey, getServiceRoleKey } from "./env.js";
import { createEdgeClient } from "./insforge-client.js";

const publicSharingCore = globalThis.__vibeusagePublicSharingCore;
if (!publicSharingCore) throw new Error("public sharing core not initialized");

export async function resolvePublicView({ baseUrl, shareToken }) {
  return publicSharingCore.resolvePublicView({
    baseUrl,
    shareToken,
    anonKey: getAnonKey(),
    serviceRoleKey: getServiceRoleKey(),
    createServiceClient: createEdgeClient,
  });
}

export const isPublicShareToken = publicSharingCore.isPublicShareToken;
