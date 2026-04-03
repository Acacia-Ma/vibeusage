import { beforeEach, describe, expect, it, vi } from "vitest";

const tokenManagerState = vi.hoisted(() => ({
  session: null as any,
}));

const tokenManagerMocks = vi.hoisted(() => ({
  getSession: vi.fn(() => tokenManagerState.session),
  getAccessToken: vi.fn(() => tokenManagerState.session?.accessToken ?? null),
  saveSession: vi.fn((session: any) => {
    tokenManagerState.session = session;
  }),
  clearSession: vi.fn(() => {
    tokenManagerState.session = null;
  }),
}));

const authMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  refreshSession: vi.fn(),
  getProfile: vi.fn(),
}));

const authClient = vi.hoisted(() => ({
  tokenManager: {
    getSession: tokenManagerMocks.getSession,
    getAccessToken: tokenManagerMocks.getAccessToken,
    saveSession: tokenManagerMocks.saveSession,
    clearSession: tokenManagerMocks.clearSession,
  },
  auth: {
    getCurrentUser: authMocks.getCurrentUser,
    refreshSession: authMocks.refreshSession,
    getProfile: authMocks.getProfile,
  },
}));

vi.mock("../insforge-client", () => ({
  createInsforgeAuthClient: vi.fn(() => authClient),
}));

function createJwt({
  sub = "u1",
  expiresInMs,
}: {
  sub?: string;
  expiresInMs: number;
}) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url")
    .replace(/=/g, "");
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      exp: Math.floor((Date.now() + expiresInMs) / 1000),
    }),
  )
    .toString("base64url")
    .replace(/=/g, "");
  return `${header}.${payload}.sig`;
}

describe("getCurrentInsforgeSession", () => {
  beforeEach(() => {
    vi.resetModules();
    tokenManagerState.session = null;
    delete (authClient.tokenManager as Record<string, unknown>).__vibeusage_auth_session_store_v1__;

    tokenManagerMocks.getSession.mockReset();
    tokenManagerMocks.getSession.mockImplementation(() => tokenManagerState.session);

    tokenManagerMocks.getAccessToken.mockReset();
    tokenManagerMocks.getAccessToken.mockImplementation(
      () => tokenManagerState.session?.accessToken ?? null,
    );

    tokenManagerMocks.saveSession.mockReset();
    tokenManagerMocks.saveSession.mockImplementation((session: any) => {
      tokenManagerState.session = session;
    });

    tokenManagerMocks.clearSession.mockReset();
    tokenManagerMocks.clearSession.mockImplementation(() => {
      tokenManagerState.session = null;
    });

    authMocks.getCurrentUser.mockReset();
    authMocks.refreshSession.mockReset();
    authMocks.getProfile.mockReset();
  });

  it("dedupes concurrent user hydration across callers", async () => {
    let resolveUser: ((value: any) => void) | null = null;
    tokenManagerState.session = {
      accessToken: createJwt({ sub: "u1", expiresInMs: 10 * 60 * 1000 }),
      user: null,
    };
    authMocks.getCurrentUser.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );

    const mod = await import("../insforge-auth-client");
    const first = mod.getCurrentInsforgeSession();
    const second = mod.getCurrentInsforgeSession();

    await vi.waitFor(() => expect(authMocks.getCurrentUser).toHaveBeenCalledTimes(1));

    resolveUser?.({
      data: {
        user: { id: "u1" },
      },
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        accessToken: tokenManagerState.session.accessToken,
        user: { id: "u1" },
      },
      {
        accessToken: tokenManagerState.session.accessToken,
        user: { id: "u1" },
      },
    ]);

    expect(tokenManagerMocks.saveSession).toHaveBeenCalledTimes(1);
    expect(tokenManagerState.session).toEqual({
      accessToken: tokenManagerState.session.accessToken,
      user: { id: "u1" },
    });
  });

  it("returns the token-manager session without extra hydration", async () => {
    tokenManagerState.session = {
      accessToken: createJwt({ sub: "u2", expiresInMs: 10 * 60 * 1000 }),
      user: {
        id: "u2",
        email: "neo@example.com",
        profile: {
          name: "",
        },
      },
    };

    const mod = await import("../insforge-auth-client");

    await expect(mod.getCurrentInsforgeSession()).resolves.toEqual(tokenManagerState.session);

    expect(authMocks.getCurrentUser).not.toHaveBeenCalled();
    expect(authMocks.getProfile).not.toHaveBeenCalled();
    expect(tokenManagerMocks.saveSession).not.toHaveBeenCalled();
  });

  it("refreshes an expired bridged session before returning it", async () => {
    tokenManagerState.session = {
      accessToken: createJwt({ sub: "u3", expiresInMs: -5 * 60 * 1000 }),
      user: { id: "u3" },
    };
    authMocks.refreshSession.mockImplementationOnce(async () => {
      authClient.tokenManager.saveSession({
        accessToken: createJwt({ sub: "u3", expiresInMs: 10 * 60 * 1000 }),
        user: { id: "u3" },
      });
      return {
        data: tokenManagerState.session,
      };
    });

    const mod = await import("../insforge-auth-client");

    await expect(mod.getCurrentInsforgeSession()).resolves.toEqual({
      accessToken: tokenManagerState.session.accessToken,
      user: { id: "u3" },
    });

    expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("publishes token-manager changes through the session store", async () => {
    const mod = await import("../insforge-auth-client");
    const snapshots: any[] = [];

    const unsubscribe = mod.subscribeInsforgeSession(() => {
      snapshots.push(mod.getInsforgeSessionSnapshot());
    });

    authClient.tokenManager.saveSession({
      accessToken: createJwt({ sub: "u4", expiresInMs: 10 * 60 * 1000 }),
      user: { id: "u4" },
    });

    expect(snapshots).toEqual([
      {
        accessToken: tokenManagerState.session.accessToken,
        user: { id: "u4" },
      },
    ]);

    unsubscribe();
    authClient.tokenManager.clearSession();

    expect(snapshots).toHaveLength(1);
  });

  it("prefers the official refreshSession flow over clearing cached auth state", async () => {
    authMocks.refreshSession.mockImplementationOnce(async () => {
      authClient.tokenManager.saveSession({
        accessToken: createJwt({ sub: "u5", expiresInMs: 10 * 60 * 1000 }),
        user: { id: "u5" },
      });
      return {
        data: tokenManagerState.session,
      };
    });

    const mod = await import("../insforge-auth-client");

    await expect(mod.refreshInsforgeSession()).resolves.toEqual({
      accessToken: tokenManagerState.session.accessToken,
      user: { id: "u5" },
    });

    expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(authMocks.getCurrentUser).not.toHaveBeenCalled();
    expect(tokenManagerMocks.clearSession).not.toHaveBeenCalled();
  });
});
