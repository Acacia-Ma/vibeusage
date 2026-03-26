export type AuthTokenProvider =
  | string
  | null
  | undefined
  | (() => string | null | undefined | Promise<string | null | undefined>)
  | {
      getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
    };

export function normalizeAccessToken(token: unknown): string | null;
export function getAccessTokenExpiryMs(token: unknown): number | null;
export function isLikelyExpiredAccessToken(token: unknown, skewMs?: number): boolean;
export function getAccessTokenUserId(token: unknown): string | null;
export function resolveAuthAccessToken(auth: AuthTokenProvider): Promise<string | null>;
export function isAccessTokenReady(token: AuthTokenProvider | unknown): boolean;
