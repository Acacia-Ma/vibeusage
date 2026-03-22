import { createInsforgeAuthClient, persistInsforgeSession } from "./insforge-client";

export const insforgeAuthClient = createInsforgeAuthClient();

let currentSessionInFlight: Promise<any> | null = null;

function normalizeName(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function hasSessionIdentity(session: any) {
  const profileName = normalizeName(session?.user?.profile?.name);
  const userName = normalizeName(session?.user?.name);
  return Boolean(profileName || userName);
}

async function hydrateSessionIdentity(session: any) {
  if (!session?.accessToken) return session ?? null;
  if (hasSessionIdentity(session)) return session;

  const userId = typeof session?.user?.id === "string" ? session.user.id : null;
  if (!userId || typeof insforgeAuthClient.auth.getProfile !== "function") {
    return session;
  }

  try {
    const { data } = await insforgeAuthClient.auth.getProfile(userId);
    const profile =
      data && typeof data === "object" && data.profile && typeof data.profile === "object"
        ? data.profile
        : null;
    const profileName = normalizeName(profile?.name);
    if (!profileName) return session;

    const mergedSession = {
      ...session,
      user: {
        ...(session.user ?? {}),
        name: profileName,
        profile: {
          ...(session?.user?.profile && typeof session.user.profile === "object"
            ? session.user.profile
            : {}),
          ...profile,
          name: profileName,
        },
      },
    };

    persistInsforgeSession(insforgeAuthClient as any, mergedSession);
    return mergedSession;
  } catch (_error) {
    return session;
  }
}

export async function getCurrentInsforgeSession() {
  if (currentSessionInFlight) return currentSessionInFlight;
  currentSessionInFlight = insforgeAuthClient.auth
    .getCurrentSession()
    .then(async ({ data }: any) => hydrateSessionIdentity(data?.session ?? null))
    .catch(() => null)
    .finally(() => {
      currentSessionInFlight = null;
    });
  return currentSessionInFlight;
}
