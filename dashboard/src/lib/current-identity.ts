import { insforgeAuthClient } from "./insforge-auth-client";

type CurrentIdentity = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveProfile(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const candidate = (data as { profile?: unknown }).profile;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as Record<string, unknown>;
}

export async function resolveCurrentIdentity(session: any): Promise<CurrentIdentity | null> {
  if (!session?.accessToken) return null;

  const userId = normalizeString(session?.user?.id);
  if (!userId) return null;

  if (typeof insforgeAuthClient.auth.getProfile !== "function") {
    return { userId, displayName: null, avatarUrl: null };
  }

  try {
    const { data } = await insforgeAuthClient.auth.getProfile(userId);
    const profile = resolveProfile(data);
    return {
      userId,
      displayName: normalizeString(profile?.name),
      avatarUrl: normalizeString(profile?.avatar_url),
    };
  } catch (_error) {
    return { userId, displayName: null, avatarUrl: null };
  }
}
