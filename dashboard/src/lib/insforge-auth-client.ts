import { createInsforgeAuthClient } from "./insforge-client";

export const insforgeAuthClient = createInsforgeAuthClient();

let currentSessionInFlight: Promise<any> | null = null;
let refreshSessionInFlight: Promise<any> | null = null;

function getTokenManager() {
  const candidate = (insforgeAuthClient as any)?.tokenManager;
  return candidate && typeof candidate === "object" ? candidate : null;
}

function getHttpClient() {
  const candidate = (insforgeAuthClient as any)?.http;
  return candidate && typeof candidate === "object" ? candidate : null;
}

export async function getCurrentInsforgeSession() {
  if (currentSessionInFlight) return currentSessionInFlight;
  currentSessionInFlight = insforgeAuthClient.auth
    .getCurrentSession()
    .then(({ data }: any) => data?.session ?? null)
    .catch(() => null)
    .finally(() => {
      currentSessionInFlight = null;
    });
  return currentSessionInFlight;
}

export async function refreshInsforgeSession() {
  if (refreshSessionInFlight) return refreshSessionInFlight;
  refreshSessionInFlight = (async () => {
    const tokenManager = getTokenManager();
    const http = getHttpClient();
    if (typeof tokenManager?.clearSession === "function") {
      tokenManager.clearSession();
    }
    if (typeof http?.setAuthToken === "function") {
      http.setAuthToken(null);
    }
    const { data } = await insforgeAuthClient.auth.getCurrentSession();
    return data?.session ?? null;
  })()
    .catch(() => null)
    .finally(() => {
      refreshSessionInFlight = null;
    });
  return refreshSessionInFlight;
}
