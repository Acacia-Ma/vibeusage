const LEGACY_AUTH_STORAGE_KEY = "vibeusage.dashboard.auth.v1";
const SESSION_EXPIRED_KEY = "vibeusage.dashboard.session_expired.v1";
const SESSION_SOFT_EXPIRED_KEY = "vibeusage.dashboard.session_soft_expired.v1";
const AUTH_EVENT_NAME = "vibeusage:auth-storage";

type SessionSoftExpiredState = {
  expiredAt: string;
  tokenFingerprint: string | null;
};

function emitAuthStorageChange() {
  if (typeof window === "undefined" || !window.dispatchEvent) return;
  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    return storage || null;
  } catch (_e) {
    return null;
  }
}

function normalizeAccessToken(token: any) {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildTokenFingerprint(token: any) {
  const normalized = normalizeAccessToken(token);
  if (!normalized) return null;
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

export function clearAuthStorage() {
  const storage = getStorage();
  if (!storage || typeof storage.removeItem !== "function") return;
  storage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  emitAuthStorageChange();
}

export function loadSessionExpired() {
  try {
    const storage = getStorage();
    if (!storage || typeof storage.getItem !== "function") return false;
    const raw = storage.getItem(SESSION_EXPIRED_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.expiredAt === "string") {
        return true;
      }
    } catch (_e) {
      return raw === "true";
    }
    return raw === "true";
  } catch (_e) {
    return false;
  }
}

export function loadSessionSoftExpired() {
  return Boolean(loadSessionSoftExpiredState());
}

export function loadSessionSoftExpiredState(): SessionSoftExpiredState | null {
  try {
    const storage = getStorage();
    if (!storage || typeof storage.getItem !== "function") return null;
    const raw = storage.getItem(SESSION_SOFT_EXPIRED_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.expiredAt === "string") {
        return {
          expiredAt: parsed.expiredAt,
          tokenFingerprint:
            typeof parsed.tokenFingerprint === "string" && parsed.tokenFingerprint.length > 0
              ? parsed.tokenFingerprint
              : null,
        };
      }
    } catch (_e) {
      return raw === "true"
        ? {
            expiredAt: "",
            tokenFingerprint: null,
          }
        : null;
    }
    return raw === "true"
      ? {
          expiredAt: "",
          tokenFingerprint: null,
        }
      : null;
  } catch (_e) {
    return null;
  }
}

export function setSessionExpired() {
  try {
    const storage = getStorage();
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(SESSION_EXPIRED_KEY, JSON.stringify({ expiredAt: new Date().toISOString() }));
  } catch (_e) {
    // ignore storage errors
  } finally {
    emitAuthStorageChange();
  }
}

export function setSessionSoftExpired(accessToken?: any) {
  try {
    const storage = getStorage();
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(
      SESSION_SOFT_EXPIRED_KEY,
      JSON.stringify({
        expiredAt: new Date().toISOString(),
        tokenFingerprint: buildTokenFingerprint(accessToken),
      }),
    );
  } catch (_e) {
    // ignore storage errors
  } finally {
    emitAuthStorageChange();
  }
}

export function clearSessionExpired() {
  try {
    const storage = getStorage();
    if (!storage || typeof storage.removeItem !== "function") return;
    storage.removeItem(SESSION_EXPIRED_KEY);
  } catch (_e) {
    // ignore storage errors
  } finally {
    emitAuthStorageChange();
  }
}

export function clearSessionSoftExpired() {
  try {
    const storage = getStorage();
    if (!storage || typeof storage.removeItem !== "function") return;
    storage.removeItem(SESSION_SOFT_EXPIRED_KEY);
  } catch (_e) {
    // ignore storage errors
  } finally {
    emitAuthStorageChange();
  }
}

export function markSessionExpired() {
  setSessionExpired();
  clearAuthStorage();
}

export function markSessionSoftExpired(accessToken?: any) {
  setSessionSoftExpired(accessToken);
}

export function shouldClearSessionSoftExpiredForToken(accessToken: any) {
  const state = loadSessionSoftExpiredState();
  if (!state) return false;
  const nextFingerprint = buildTokenFingerprint(accessToken);
  if (!nextFingerprint) return false;
  if (!state.tokenFingerprint) return true;
  return state.tokenFingerprint !== nextFingerprint;
}

export function subscribeAuthStorage(handler: any) {
  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {};
  }
  const onChange = () => {
    handler({
      sessionExpired: loadSessionExpired(),
      sessionSoftExpired: loadSessionSoftExpired(),
    });
  };
  window.addEventListener(AUTH_EVENT_NAME, onChange);
  return () => window.removeEventListener(AUTH_EVENT_NAME, onChange);
}

export function subscribeSessionExpired(handler: any) {
  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {};
  }
  const onChange = () => {
    handler(loadSessionExpired());
  };
  window.addEventListener(AUTH_EVENT_NAME, onChange);
  return () => window.removeEventListener(AUTH_EVENT_NAME, onChange);
}

export function subscribeSessionSoftExpired(handler: any) {
  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {};
  }
  const onChange = () => {
    handler(loadSessionSoftExpired());
  };
  window.addEventListener(AUTH_EVENT_NAME, onChange);
  return () => window.removeEventListener(AUTH_EVENT_NAME, onChange);
}
