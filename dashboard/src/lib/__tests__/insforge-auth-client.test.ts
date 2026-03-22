import { beforeEach, describe, expect, it, vi } from "vitest";

const authClient = vi.hoisted(() => ({
  auth: {
    getCurrentSession: vi.fn(),
    getProfile: vi.fn(),
  },
}));

const persistInsforgeSession = vi.hoisted(() => vi.fn());

vi.mock("../insforge-client", () => ({
  createInsforgeAuthClient: vi.fn(() => authClient),
  persistInsforgeSession,
}));

describe("getCurrentInsforgeSession", () => {
  beforeEach(() => {
    vi.resetModules();
    authClient.auth.getCurrentSession.mockReset();
    authClient.auth.getProfile.mockReset();
    persistInsforgeSession.mockReset();
  });

  it("dedupes concurrent session reads across callers", async () => {
    let resolveSession: ((value: any) => void) | null = null;
    authClient.auth.getCurrentSession.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    const mod = await import("../insforge-auth-client");
    const first = mod.getCurrentInsforgeSession();
    const second = mod.getCurrentInsforgeSession();

    await vi.waitFor(() => expect(authClient.auth.getCurrentSession).toHaveBeenCalledTimes(1));

    resolveSession?.({
      data: {
        session: {
          accessToken: "token-1",
          user: { id: "u1" },
        },
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
  });

  it("hydrates missing identity from profile when session name is absent", async () => {
    authClient.auth.getCurrentSession.mockResolvedValueOnce({
      data: {
        session: {
          accessToken: "token-2",
          user: {
            id: "u2",
            email: "neo@example.com",
            profile: null,
          },
        },
      },
    });
    authClient.auth.getProfile.mockResolvedValueOnce({
      data: {
        id: "u2",
        profile: {
          name: "Neo",
          avatar_url: "https://example.com/neo.png",
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
          name: "Neo",
          avatar_url: "https://example.com/neo.png",
        },
        name: "Neo",
      },
    });

    expect(authClient.auth.getProfile).toHaveBeenCalledWith("u2");
    expect(persistInsforgeSession).toHaveBeenCalledTimes(1);
  });
});
