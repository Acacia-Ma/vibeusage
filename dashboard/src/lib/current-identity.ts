import { getInsforgeBaseUrl } from "./config";
import { getViewerIdentity } from "./vibeusage-api";

type CurrentIdentity = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function resolveCurrentIdentity(session: any): Promise<CurrentIdentity | null> {
  if (!session?.accessToken) return null;

  const userId = normalizeString(session?.user?.id);
  if (!userId) return null;

  try {
    const data = await getViewerIdentity({
      baseUrl: getInsforgeBaseUrl(),
      accessToken: session.accessToken,
    });
    return {
      userId,
      displayName: normalizeString((data as { display_name?: unknown } | null)?.display_name),
      avatarUrl: normalizeString((data as { avatar_url?: unknown } | null)?.avatar_url),
    };
  } catch (_error) {
    return { userId, displayName: null, avatarUrl: null };
  }
}
