import { beforeEach, describe, expect, it, vi } from "vitest";

const authClient = vi.hoisted(() => ({
  tokenManager: {
    getSession: vi.fn(),
    getAccessToken: vi.fn(),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
  },
  auth: {
    getCurrentUser: vi.fn(),
    refreshSession: vi.fn(),
    getProfile: vi.fn(),
  },
}));

vi.mock("../insforge-client", () => ({
  createInsforgeAuthClient: vi.fn(() => authClient),
}));

describe("getCurrentInsforgeSession", () => {
  beforeEach(() => {
    vi.resetModules();
    authClient.auth.getCurrentUser.mockReset();
    authClient.auth.refreshSession.mockReset();
    authClient.auth.getProfile.mockReset();
    authClient.tokenManager.getSession.mockReset();
    authClient.tokenManager.getAccessToken.mockReset();
    authClient.tokenManager.saveSession.mockReset();
    authClient.tokenManager.clearSession.mockReset();
    authClient.tokenManager.getSession.mockReturnValue(null);
    authClient.tokenManager.getAccessToken.mockReturnValue(null);
  });

  it("dedupes concurrent user hydration across callers", async () => {
    let resolveUser: ((value: any) => void) | null = null;
    authClient.tokenManager.getAccessToken.mockReturnValue("token-1");
    authClient.auth.getCurrentUser.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );

    const mod = await import("../insforge-auth-client");
    const first = mod.getCurrentInsforgeSession();
    const second = mod.getCurrentInsforgeSession();

    await vi.waitFor(() => expect(authClient.auth.getCurrentUser).toHaveBeenCalledTimes(1));

    resolveUser?.({
      data: {
        user: { id: "u1" },
      },
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        accessToken: "token-1",
        user: { id: "u1" },
      },
      {
        accessToken: "token-1",
        user: { id: "u1" },
      },
    ]);

    expect(authClient.tokenManager.saveSession).toHaveBeenCalledTimes(1);
    expect(authClient.tokenManager.saveSession).toHaveBeenCalledWith({
      accessToken: "token-1",
      user: { id: "u1" },
    });
  });

  it("returns the token-manager session without extra hydration", async () => {
    authClient.tokenManager.getSession.mockReturnValue({
      accessToken: "token-2",
      user: {
        id: "u2",
        email: "neo@example.com",
        profile: {
          name: "",
        },
      },
    });

    const mod = await import("../insforge-auth-client");

    await expect(mod.getCurrentInsforgeSession()).resolves.toEqual({
      accessToken: "token-2",
      user: {
        id: "u2",
        email: "neo@example.com",
        profile: {
          name: "",
        },
      },
    });

    expect(authClient.auth.getCurrentUser).not.toHaveBeenCalled();
    expect(authClient.auth.getProfile).not.toHaveBeenCalled();
    expect(authClient.tokenManager.saveSession).not.toHaveBeenCalled();
  });

  it("prefers the official refreshSession flow over clearing cached auth state", async () => {
    authClient.auth.refreshSession.mockResolvedValueOnce({
      data: {
        accessToken: "token-3",
        user: { id: "u3" },
      },
    });

    const mod = await import("../insforge-auth-client");

    await expect(mod.refreshInsforgeSession()).resolves.toEqual({
      accessToken: "token-3",
      user: { id: "u3" },
    });

    expect(authClient.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(authClient.auth.getCurrentUser).not.toHaveBeenCalled();
    expect(authClient.tokenManager.clearSession).not.toHaveBeenCalled();
  });
});
