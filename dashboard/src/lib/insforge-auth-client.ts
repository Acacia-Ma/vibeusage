import { createInsforgeAuthClient } from "./insforge-client";

export const insforgeAuthClient = createInsforgeAuthClient();

let currentSessionInFlight: Promise<any> | null = null;
let refreshSessionInFlight: Promise<any> | null = null;

function normalizeSessionResult(result: any) {
  return result?.data?.session ?? result?.data ?? null;
}

function getTokenManager() {
  const candidate = (insforgeAuthClient as any)?.tokenManager;
  return candidate && typeof candidate === "object" ? candidate : null;
}

function buildSessionFromTokenManager() {
  const tokenManager = getTokenManager();
  if (!tokenManager) return null;
  const session =
    typeof tokenManager.getSession === "function" ? tokenManager.getSession() : null;
  if (session?.accessToken && session.user) {
    return session;
  }
  const accessToken =
    session?.accessToken ??
    (typeof tokenManager.getAccessToken === "function" ? tokenManager.getAccessToken() : null);
  if (!accessToken) return null;
  return {
    accessToken,
    user: session?.user ?? null,
  };
}

export async function getCurrentInsforgeSession() {
  if (currentSessionInFlight) return currentSessionInFlight;
  currentSessionInFlight = (async () => {
    const snapshot = buildSessionFromTokenManager();
    if (snapshot?.accessToken && snapshot.user) {
      return snapshot;
    }

    const getCurrentUser = (insforgeAuthClient as any)?.auth?.getCurrentUser;
    if (typeof getCurrentUser !== "function") {
      return null;
    }

    const result = await getCurrentUser.call((insforgeAuthClient as any).auth);
    const user = result?.data?.user ?? null;
    const accessToken = snapshot?.accessToken ?? buildSessionFromTokenManager()?.accessToken ?? null;
    if (!user || !accessToken) {
      return null;
    }

    const hydratedSession = { accessToken, user };
    const tokenManager = getTokenManager();
    if (typeof tokenManager?.saveSession === "function") {
      tokenManager.saveSession(hydratedSession);
    }
    return hydratedSession;
  })()
    .catch(() => null)
    .finally(() => {
      currentSessionInFlight = null;
    });
  return currentSessionInFlight;
}

export async function refreshInsforgeSession() {
  if (refreshSessionInFlight) return refreshSessionInFlight;
  refreshSessionInFlight = (async () => {
    const refreshSession = (insforgeAuthClient as any)?.auth?.refreshSession;
    if (typeof refreshSession !== "function") {
      return null;
    }
    const result = await refreshSession.call((insforgeAuthClient as any).auth);
    return normalizeSessionResult(result);
  })()
    .catch(() => null)
    .finally(() => {
      refreshSessionInFlight = null;
    });
  return refreshSessionInFlight;
}
