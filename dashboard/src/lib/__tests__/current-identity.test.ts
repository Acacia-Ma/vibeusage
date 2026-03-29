import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getViewerIdentity: vi.fn(),
}));

vi.mock("../vibeusage-api", () => ({
  getViewerIdentity: api.getViewerIdentity,
}));

describe("resolveCurrentIdentity", () => {
  function makeJwt(payload: Record<string, unknown>) {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url").replace(/=/g, "");
    return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
  }
  beforeEach(() => {
    vi.resetModules();
    api.getViewerIdentity.mockReset();
  });

  it("resolves identity from viewer identity instead of stale session name", async () => {
    api.getViewerIdentity.mockResolvedValueOnce({
      user_id: "u1",
      display_name: "Neo Prime",
      avatar_url: "https://example.com/neo.png",
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

  it("preserves null display name when viewer identity is anonymous", async () => {
    api.getViewerIdentity.mockResolvedValueOnce({
      user_id: "u2",
      display_name: null,
      avatar_url: "https://example.com/ghost.png",
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

    expect(api.getViewerIdentity).not.toHaveBeenCalled();
  });

  it("derives user id from jwt sub when session user is missing", async () => {
    api.getViewerIdentity.mockResolvedValueOnce({
      user_id: "u4",
      display_name: "Token Neo",
      avatar_url: null,
    });

    const mod = await import("../current-identity");

    await expect(
      mod.resolveCurrentIdentity({
        accessToken: makeJwt({ sub: "u4", exp: Math.floor(Date.now() / 1000) + 3600 }),
        user: null,
      }),
    ).resolves.toEqual({
      userId: "u4",
      displayName: "Token Neo",
      avatarUrl: null,
    });

    expect(api.getViewerIdentity).toHaveBeenCalledTimes(1);
  });

  it("uses viewer identity even when only metadata full_name exists upstream", async () => {
    api.getViewerIdentity.mockResolvedValueOnce({
      user_id: "u3",
      display_name: "Meta Neo",
      avatar_url: null,
    });

    const mod = await import("../current-identity");

    await expect(
      mod.resolveCurrentIdentity({
        accessToken: "token-3",
        user: {
          id: "u3",
          profile: {
            name: "",
          },
        },
      }),
    ).resolves.toEqual({
      userId: "u3",
      displayName: "Meta Neo",
      avatarUrl: null,
    });
  });
  it("returns placeholder identity when viewer identity cannot be resolved", async () => {
    api.getViewerIdentity.mockRejectedValueOnce(new Error("boom"));

    const mod = await import("../current-identity");

    await expect(
      mod.resolveCurrentIdentity({
        accessToken: "token-4",
        user: {
          id: "u4",
        },
      }),
    ).resolves.toEqual({
      userId: "u4",
      displayName: null,
      avatarUrl: null,
    });
  });
});
