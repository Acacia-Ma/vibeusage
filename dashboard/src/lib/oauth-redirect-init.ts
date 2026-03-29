import {
  clearAuthStorage,
  clearSessionExpired,
  clearSessionSoftExpired,
} from "./auth-storage";
import { insforgeAuthClient } from "./insforge-auth-client";
import { clearInsforgePersistentStorage } from "./insforge-client";

const REDIRECT_REENTRY_COOLDOWN_MS = 3_000;
const redirectInitInFlight = new Map<string, Promise<void>>();
const redirectInitAt = new Map<string, number>();

export async function startGithubOAuthRedirect({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  const key = normalizeRedirectKey(callbackUrl);
  const existing = redirectInitInFlight.get(key);
  if (existing) {
    return await existing;
  }

  const lastStartedAt = redirectInitAt.get(key) ?? 0;
  if (Date.now() - lastStartedAt < REDIRECT_REENTRY_COOLDOWN_MS) {
    return;
  }
  redirectInitAt.set(key, Date.now());

  const pending = (async () => {
    // Force a clean auth state so stale mobile sessions cannot short-circuit
    // OAuth and bounce back to a useless dashboard.
    await insforgeAuthClient.auth.signOut().catch(() => {});
    clearInsforgePersistentStorage();
    clearAuthStorage();
    clearSessionExpired();
    clearSessionSoftExpired();

    const { error } = await insforgeAuthClient.auth.signInWithOAuth({
      provider: "github",
      redirectTo: callbackUrl,
    });
    if (error) throw error;
  })();

  redirectInitInFlight.set(key, pending);
  try {
    await pending;
  } catch (error) {
    redirectInitAt.delete(key);
    throw error;
  } finally {
    if (redirectInitInFlight.get(key) === pending) {
      redirectInitInFlight.delete(key);
    }
  }
}

function normalizeRedirectKey(callbackUrl: string) {
  const value = typeof callbackUrl === "string" ? callbackUrl.trim() : "";
  return value || "__default__";
}
