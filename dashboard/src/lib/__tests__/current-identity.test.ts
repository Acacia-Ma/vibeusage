import { beforeEach, describe, expect, it, vi } from "vitest";

const authClient = vi.hoisted(() => ({
  auth: {
    getProfile: vi.fn(),
  },
}));

vi.mock("../insforge-auth-client", () => ({
  insforgeAuthClient: authClient,
}));

describe("resolveCurrentIdentity", () => {
  beforeEach(() => {
    vi.resetModules();
    authClient.auth.getProfile.mockReset();
  });

  it("resolves identity from profile instead of stale session name", async () => {
    authClient.auth.getProfile.mockResolvedValueOnce({
      data: {
        id: "u1",
        profile: {
          name: "Neo Prime",
          avatar_url: "https://example.com/neo.png",
        },
      },
    });

    const mod = await import("../current-identity");

    await expect(
      mod.resolveCurrentIdentity({
        accessToken: "token-1",
        user: {
          id: "u1",
          name: "Stale Name",
          profile: {
            name: "Stale Name",
          },
        },
      }),
    ).resolves.toEqual({
      userId: "u1",
      displayName: "Neo Prime",
      avatarUrl: "https://example.com/neo.png",
    });
  });

  it("returns anonymous identity when profile name is missing", async () => {
    authClient.auth.getProfile.mockResolvedValueOnce({
      data: {
        id: "u2",
        profile: {
          avatar_url: "https://example.com/ghost.png",
        },
      },
    });

    const mod = await import("../current-identity");

    await expect(
      mod.resolveCurrentIdentity({
        accessToken: "token-2",
        user: {
          id: "u2",
        },
      }),
    ).resolves.toEqual({
      userId: "u2",
      displayName: null,
      avatarUrl: "https://example.com/ghost.png",
    });
  });

  it("returns null when session cannot identify the user", async () => {
    const mod = await import("../current-identity");

    await expect(
      mod.resolveCurrentIdentity({
        accessToken: "token-3",
        user: null,
      }),
    ).resolves.toBeNull();

    expect(authClient.auth.getProfile).not.toHaveBeenCalled();
  });
});
