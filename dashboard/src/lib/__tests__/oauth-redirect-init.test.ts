import { describe, expect, it, vi, beforeEach } from "vitest";

const signOut = vi.fn(async () => {});
const signInWithOAuth = vi.fn(async () => ({ error: null }));
const clearInsforgePersistentStorage = vi.fn();
const clearAuthStorage = vi.fn();
const clearSessionExpired = vi.fn();
const clearSessionSoftExpired = vi.fn();

vi.mock("../insforge-auth-client", () => ({
  insforgeAuthClient: {
    auth: {
      signOut,
      signInWithOAuth,
    },
  },
}));

vi.mock("../insforge-client", () => ({
  clearInsforgePersistentStorage,
}));

vi.mock("../auth-storage", () => ({
  clearAuthStorage,
  clearSessionExpired,
  clearSessionSoftExpired,
}));

describe("startGithubOAuthRedirect", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    signOut.mockReset();
    signInWithOAuth.mockReset();
    clearInsforgePersistentStorage.mockReset();
    clearAuthStorage.mockReset();
    clearSessionExpired.mockReset();
    clearSessionSoftExpired.mockReset();
    signOut.mockResolvedValue(undefined);
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("dedupes concurrent launches and suppresses immediate re-entry", async () => {
    let resolveOAuth: ((value: { error: null }) => void) | null = null;
    signInWithOAuth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOAuth = resolve as (value: { error: null }) => void;
        }),
    );

    const { startGithubOAuthRedirect } = await import("../oauth-redirect-init");

    const first = startGithubOAuthRedirect({ callbackUrl: "https://example.com/auth/callback" });
    const second = startGithubOAuthRedirect({ callbackUrl: "https://example.com/auth/callback" });

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    });

    resolveOAuth?.({ error: null });
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();

    await expect(
      startGithubOAuthRedirect({ callbackUrl: "https://example.com/auth/callback" }),
    ).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  });

  it("clears the guard after oauth init failure so retry can proceed immediately", async () => {
    const failure = new Error("oauth init failed");
    signInWithOAuth.mockResolvedValueOnce({ error: failure }).mockResolvedValueOnce({ error: null });

    const { startGithubOAuthRedirect } = await import("../oauth-redirect-init");

    await expect(
      startGithubOAuthRedirect({ callbackUrl: "https://example.com/auth/callback" }),
    ).rejects.toThrow("oauth init failed");

    await expect(
      startGithubOAuthRedirect({ callbackUrl: "https://example.com/auth/callback" }),
    ).resolves.toBeUndefined();

    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signInWithOAuth).toHaveBeenCalledTimes(2);
  });
});
