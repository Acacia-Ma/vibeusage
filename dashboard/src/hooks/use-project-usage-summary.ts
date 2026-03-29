import { useCallback, useEffect, useState } from "react";
import { isAccessTokenReady, resolveAuthAccessToken } from "../lib/auth-token";
import { isMockEnabled } from "../lib/mock-data";
import { getProjectUsageSummary } from "../lib/vibeusage-api";

export function useProjectUsageSummary({
  baseUrl,
  accessToken,
  guestAllowed = false,
  limit = 3,
  allTime = false,
  from,
  to,
  source,
  timeZone,
  tzOffsetMinutes,
}: any = {}) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockEnabled = isMockEnabled();
  const tokenReady = isAccessTokenReady(accessToken);
  const requestFrom = allTime ? undefined : from;
  const requestTo = allTime ? undefined : to;

  const refresh = useCallback(async ({ signal }: any = {}) => {
    const resolvedToken = await resolveAuthAccessToken(accessToken);
    if (!resolvedToken && !mockEnabled) {
      if (!guestAllowed) {
        setEntries([]);
        setError(null);
        setLoading(false);
      }
      return;
    }
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getProjectUsageSummary({
        baseUrl,
        accessToken: resolvedToken,
        limit,
        from: requestFrom,
        to: requestTo,
        source,
        timeZone,
        tzOffsetMinutes,
        signal,
      });
      if (signal?.aborted) return;
      setEntries(Array.isArray(res?.entries) ? res.entries : []);
    } catch (err) {
      if (signal?.aborted || (err as any)?.name === "AbortError") return;
      const message = (err as any)?.message || String(err);
      setError(message);
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [
    accessToken,
    baseUrl,
    guestAllowed,
    limit,
    mockEnabled,
    requestFrom,
    requestTo,
    source,
    timeZone,
    tzOffsetMinutes,
  ]);

  useEffect(() => {
    if (!tokenReady && !guestAllowed && !mockEnabled) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (tokenReady || !guestAllowed || mockEnabled) {
      setLoading(true);
      setError(null);
    }
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [guestAllowed, mockEnabled, refresh, tokenReady]);

  return { entries, loading, error, refresh };
}
