import { beforeEach, describe, expect, it, vi } from "vitest";

const authClient = vi.hoisted(() => ({
  auth: {
    getCurrentSession: vi.fn(),
  },
}));

vi.mock("../insforge-client", () => ({
  createInsforgeAuthClient: vi.fn(() => authClient),
}));

describe("getCurrentInsforgeSession", () => {
  beforeEach(() => {
    vi.resetModules();
    authClient.auth.getCurrentSession.mockReset();
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
});
