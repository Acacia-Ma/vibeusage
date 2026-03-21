import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const authStorage = vi.hoisted(() => ({
  clearSessionSoftExpired: vi.fn(),
  markSessionSoftExpired: vi.fn(),
}));

const authClient = vi.hoisted(() => ({
  auth: {
    getCurrentSession: vi.fn(async () => ({ data: { session: null } })),
  },
}));

vi.mock("../insforge-client", () => ({
  createInsforgeClient: vi.fn(() => ({
    getHttpClient: () => http,
  })),
  createInsforgeAuthClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock("../auth-storage", () => authStorage);

vi.mock("../insforge-auth-client", () => ({
  insforgeAuthClient: authClient,
  getCurrentInsforgeSession: vi.fn(async () => {
    const { data } = await authClient.auth.getCurrentSession();
    return data?.session ?? null;
  }),
}));

vi.mock("../auth-token", () => ({
  normalizeAccessToken: vi.fn((token: any) =>
    typeof token === "string" && token.trim() ? token.trim() : null,
  ),
  resolveAuthAccessToken: vi.fn(async (token: any) => token),
}));

vi.mock("../mock-data", () => ({
  isMockEnabled: vi.fn(() => false),
  getMockUsageSummary: vi.fn(),
  getMockLeaderboard: vi.fn(),
}));

let api: typeof import("../vibeusage-api");

beforeAll(async () => {
  api = await import("../vibeusage-api");
});

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.get.mockResolvedValue({ data: {} });
  authStorage.clearSessionSoftExpired.mockReset();
  authStorage.markSessionSoftExpired.mockReset();
  authClient.auth.getCurrentSession.mockReset();
  authClient.auth.getCurrentSession.mockResolvedValue({ data: { session: null } });
});

describe("getUsageSummary", () => {
  const baseArgs = {
    baseUrl: "https://example.com",
    accessToken: "token",
    from: "2026-01-01",
    to: "2026-01-02",
  };

  it("omits rolling by default", async () => {
    await api.getUsageSummary(baseArgs);
    const [, options] = http.get.mock.calls[0];
    expect(options?.params?.rolling).toBeUndefined();
  });

  it("includes rolling when enabled", async () => {
    await api.getUsageSummary({ ...baseArgs, rolling: true });
    const [, options] = http.get.mock.calls[0];
    expect(options?.params?.rolling).toBe("1");
  });

  it("dedupes concurrent identical summary requests", async () => {
    let resolveHttp: ((value: any) => void) | null = null;
    const httpPromise = new Promise((resolve) => {
      resolveHttp = resolve;
    });
    http.get.mockReturnValueOnce(httpPromise);

    const first = api.getUsageSummary({ ...baseArgs, rolling: true });
    const second = api.getUsageSummary({ ...baseArgs, rolling: true });

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(1));

    resolveHttp?.({ totals: { total_tokens: "42" }, rolling: null });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { totals: { total_tokens: "42" }, rolling: null },
      { totals: { total_tokens: "42" }, rolling: null },
    ]);
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});

describe("getUsageModelBreakdown", () => {
  const baseArgs = {
    baseUrl: "https://example.com",
    accessToken: "token",
    from: "2024-04-01",
    to: "2026-03-21",
  };

  it("dedupes concurrent identical model breakdown requests", async () => {
    let resolveHttp: ((value: any) => void) | null = null;
    const httpPromise = new Promise((resolve) => {
      resolveHttp = resolve;
    });
    http.get.mockReturnValueOnce(httpPromise);

    const first = api.getUsageModelBreakdown(baseArgs);
    const second = api.getUsageModelBreakdown(baseArgs);

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(1));

    resolveHttp?.({ sources: [] });

    await expect(Promise.all([first, second])).resolves.toEqual([{ sources: [] }, { sources: [] }]);
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});

describe("request scheduling", () => {
  it("does not start different GET requests concurrently", async () => {
    const resolvers: Array<(value: any) => void> = [];
    http.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const summaryPromise = api.getUsageSummary({
      baseUrl: "https://example.com",
      accessToken: "token",
      from: "2024-04-01",
      to: "2026-03-21",
      rolling: true,
    });
    const breakdownPromise = api.getUsageModelBreakdown({
      baseUrl: "https://example.com",
      accessToken: "token",
      from: "2024-04-01",
      to: "2026-03-21",
    });

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(1));

    resolvers[0]?.({ totals: { total_tokens: "42" }, rolling: null });

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));

    resolvers[1]?.({ sources: [] });

    await expect(summaryPromise).resolves.toEqual({
      totals: { total_tokens: "42" },
      rolling: null,
    });
    await expect(breakdownPromise).resolves.toEqual({ sources: [] });
  });

  it("drops aborted queued GET requests before they consume the queue", async () => {
    const resolvers: Array<(value: any) => void> = [];
    http.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const first = api.getUsageSummary({
      baseUrl: "https://example.com",
      accessToken: "token",
      from: "2024-04-01",
      to: "2026-03-21",
      rolling: true,
    });

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(1));

    const controller = new AbortController();
    const second = api.getUsageModelBreakdown({
      baseUrl: "https://example.com",
      accessToken: "token",
      from: "2024-04-01",
      to: "2026-03-21",
      signal: controller.signal,
    });
    const secondAssertion = expect(second).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();

    const third = api.getProjectUsageSummary({
      baseUrl: "https://example.com",
      accessToken: "token",
      from: "2024-04-01",
      to: "2026-03-21",
      limit: 3,
    });

    resolvers[0]?.({ totals: { total_tokens: "42" }, rolling: null });

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));

    resolvers[1]?.({ entries: [{ project_key: "owner/repo" }] });

    await expect(first).resolves.toEqual({
      totals: { total_tokens: "42" },
      rolling: null,
    });
    await secondAssertion;
    await expect(third).resolves.toEqual({
      entries: [{ project_key: "owner/repo" }],
    });
  });
});

describe("error normalization", () => {
  const jwtToken = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .toString("base64url")
      .replace(/=/g, ""),
    Buffer.from(JSON.stringify({ sub: "user-1", iat: 1773954516, exp: 1773955416 }))
      .toString("base64url")
      .replace(/=/g, ""),
    "sig",
  ].join(".");

  it("uses the InsForgeError `error` field when message is empty", async () => {
    http.get.mockRejectedValueOnce({
      name: "InsForgeError",
      message: "",
      error: "Missing bearer token",
      statusCode: 401,
    });

    await expect(
      api.probeBackend({ baseUrl: "https://example.com", accessToken: null }),
    ).rejects.toMatchObject({
      message: "Missing bearer token",
      status: 401,
      statusCode: 401,
    });
  });

  it("marks soft expiry with the failing access token on 401", async () => {
    http.get.mockRejectedValueOnce({
      name: "InsForgeError",
      message: "",
      error: "Missing bearer token",
      statusCode: 401,
    });

    await expect(
      api.getUsageSummary({
        baseUrl: "https://example.com",
        accessToken: jwtToken,
        from: "2026-01-01",
        to: "2026-01-02",
      }),
    ).rejects.toMatchObject({
      status: 401,
    });

    expect(authStorage.markSessionSoftExpired).toHaveBeenCalledWith(jwtToken);
  });
});
