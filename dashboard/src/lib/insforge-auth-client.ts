import { createInsforgeAuthClient } from "./insforge-client";
import {
  clearSessionSoftExpired,
  isSessionSoftExpiredForToken,
  markSessionSoftExpired,
} from "./auth-storage";
import { isLikelyExpiredAccessToken } from "./auth-token";

export const insforgeAuthClient = createInsforgeAuthClient();

let currentSessionInFlight: Promise<any> | null = null;
let refreshSessionInFlight: Promise<{ session: any; error: any }> | null = null;
let currentSessionSnapshot: any = undefined;
const sessionListeners = new Set<() => void>();

function normalizeSessionResult(result: any) {
  return result?.data?.session ?? result?.data ?? null;
}

function getTokenManager() {
  const candidate = (insforgeAuthClient as any)?.tokenManager;
  return candidate && typeof candidate === "object" ? candidate : null;
}

function emitSessionSnapshot() {
  currentSessionSnapshot = buildSessionFromTokenManager();
  for (const listener of sessionListeners) {
    listener();
  }
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

function hasUsableAccessToken(session: any) {
  const accessToken = session?.accessToken ?? null;
  return Boolean(accessToken && !isLikelyExpiredAccessToken(accessToken));
}

function getErrorText(error: any) {
  return [
    error?.error,
    error?.code,
    error?.message,
    error?.cause?.error,
    error?.cause?.code,
    error?.cause?.message,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase();
}

function getErrorStatus(error: any) {
  const status = error?.statusCode ?? error?.status ?? error?.cause?.statusCode ?? error?.cause?.status;
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

function isExplicitPermanentRefreshFailure(error: any) {
  if (!error) return false;
  const code = typeof error?.code === "string" ? error.code : null;
  if (code === "REFRESH_SESSION_EMPTY" || code === "REFRESH_SESSION_UNSUPPORTED") {
    return true;
  }
  const text = getErrorText(error);
  return /invalid[_ -]?grant|invalid[_ -]?token|refresh[_ -]?token|revoked/.test(text);
}

function isGenericAuthRefreshFailure(error: any) {
  if (!error) return false;
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return true;
  return /unauthorized|forbidden/.test(getErrorText(error));
}

function ensureSessionStoreInstalled() {
  const tokenManager = getTokenManager();
  if (!tokenManager) {
    currentSessionSnapshot = null;
    return;
  }

  const marker = "__vibeusage_auth_session_store_v1__";
  if ((tokenManager as Record<string, unknown>)[marker]) {
    if (currentSessionSnapshot === undefined) {
      currentSessionSnapshot = buildSessionFromTokenManager();
    }
    return;
  }

  const originalSaveSession =
    typeof tokenManager.saveSession === "function" ? tokenManager.saveSession.bind(tokenManager) : null;
  const originalClearSession =
    typeof tokenManager.clearSession === "function" ? tokenManager.clearSession.bind(tokenManager) : null;

  if (originalSaveSession) {
    tokenManager.saveSession = (session: any) => {
      originalSaveSession(session);
      emitSessionSnapshot();
    };
  }

  if (originalClearSession) {
    tokenManager.clearSession = () => {
      originalClearSession();
      emitSessionSnapshot();
    };
  }

  (tokenManager as Record<string, unknown>)[marker] = true;
  currentSessionSnapshot = buildSessionFromTokenManager();
}

async function hydrateCurrentUser(snapshot: any) {
  const getCurrentUser = (insforgeAuthClient as any)?.auth?.getCurrentUser;
  if (typeof getCurrentUser !== "function") {
    return hasUsableAccessToken(snapshot) ? snapshot : null;
  }

  const result = await getCurrentUser.call((insforgeAuthClient as any).auth);
  const user = result?.data?.user ?? null;
  const accessToken = buildSessionFromTokenManager()?.accessToken ?? snapshot?.accessToken ?? null;
  if (!accessToken || isLikelyExpiredAccessToken(accessToken)) {
    return null;
  }
  if (!user) {
    return {
      accessToken,
      user: snapshot?.user ?? null,
    };
  }

  const hydratedSession = { accessToken, user };
  const tokenManager = getTokenManager();
  if (typeof tokenManager?.saveSession === "function") {
    tokenManager.saveSession(hydratedSession);
  }
  return hydratedSession;
}

export function getInsforgeSessionSnapshot() {
  ensureSessionStoreInstalled();
  return currentSessionSnapshot;
}

export function subscribeInsforgeSession(listener: () => void) {
  ensureSessionStoreInstalled();
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export async function getCurrentInsforgeSession() {
  ensureSessionStoreInstalled();
  if (currentSessionInFlight) return currentSessionInFlight;
  currentSessionInFlight = (async () => {
    const snapshot = buildSessionFromTokenManager();
    if (hasUsableAccessToken(snapshot) && snapshot?.user) {
      return snapshot;
    }

    if (snapshot?.accessToken && isLikelyExpiredAccessToken(snapshot.accessToken)) {
      const { session: refreshedSession, error: refreshError } = await refreshInsforgeSessionOutcome();
      if (hasUsableAccessToken(refreshedSession)) {
        if (refreshedSession?.user) {
          return refreshedSession;
        }
        return await hydrateCurrentUser(refreshedSession);
      }
      const shouldClearSoftExpired =
        isExplicitPermanentRefreshFailure(refreshError) ||
        (isGenericAuthRefreshFailure(refreshError) &&
          isSessionSoftExpiredForToken(snapshot.accessToken));
      if (shouldClearSoftExpired) {
        clearSessionSoftExpired();
      } else {
        markSessionSoftExpired(snapshot.accessToken);
      }
      return null;
    }

    return await hydrateCurrentUser(snapshot);
  })()
    .catch(() => null)
    .finally(() => {
      emitSessionSnapshot();
      currentSessionInFlight = null;
    });
  return currentSessionInFlight;
}

export async function refreshInsforgeSession() {
  const { session } = await refreshInsforgeSessionOutcome();
  return session;
}

async function refreshInsforgeSessionOutcome() {
  ensureSessionStoreInstalled();
  if (refreshSessionInFlight) return refreshSessionInFlight;
  refreshSessionInFlight = (async () => {
    const refreshSession = (insforgeAuthClient as any)?.auth?.refreshSession;
    if (typeof refreshSession !== "function") {
      return {
        session: null,
        error: {
          statusCode: 400,
          code: "REFRESH_SESSION_UNSUPPORTED",
          message: "refreshSession is not available",
        },
      };
    }
    const result = await refreshSession.call((insforgeAuthClient as any).auth);
    const snapshot = buildSessionFromTokenManager();
    if (hasUsableAccessToken(snapshot)) {
      return { session: snapshot, error: null };
    }
    const normalized = normalizeSessionResult(result);
    const resultError = result?.error ?? null;
    if (!resultError && !hasUsableAccessToken(normalized)) {
      return {
        session: null,
        error: {
          statusCode: 400,
          code: "REFRESH_SESSION_EMPTY",
          message: "refreshSession returned no usable session",
        },
      };
    }
    return {
      session: hasUsableAccessToken(normalized) ? normalized : null,
      error: resultError,
    };
  })()
    .catch((error) => ({ session: null, error }))
    .finally(() => {
      emitSessionSnapshot();
      refreshSessionInFlight = null;
    });
  return refreshSessionInFlight;
}
