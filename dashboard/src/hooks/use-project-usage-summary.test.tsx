import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectUsageSummary } from "./use-project-usage-summary";

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const mockData = vi.hoisted(() => ({
  isMockEnabled: vi.fn(() => false),
}));

const vibeusageApi = vi.hoisted(() => ({
  getProjectUsageSummary: vi.fn(async () => ({ entries: [] })),
}));

vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);

describe("useProjectUsageSummary", () => {
  afterEach(() => {
    authToken.isAccessTokenReady.mockReset();
    authToken.isAccessTokenReady.mockImplementation((token: any) => Boolean(token));
    authToken.resolveAuthAccessToken.mockReset();
    authToken.resolveAuthAccessToken.mockImplementation(async (token: any) => token ?? null);
    mockData.isMockEnabled.mockReset();
    mockData.isMockEnabled.mockReturnValue(false);
    vibeusageApi.getProjectUsageSummary.mockReset();
    vibeusageApi.getProjectUsageSummary.mockResolvedValue({ entries: [] });
  });

  it("preserves loaded entries when guest mode takes over after token loss", async () => {
    const initialEntries = [
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        total_tokens: "42",
      },
    ];

    vibeusageApi.getProjectUsageSummary.mockResolvedValueOnce({ entries: initialEntries });

    const { result, rerender } = renderHook((props: any) => useProjectUsageSummary(props), {
      initialProps: {
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
      },
    });

    await waitFor(() => expect(result.current.entries).toEqual(initialEntries));
    expect(vibeusageApi.getProjectUsageSummary).toHaveBeenCalledTimes(1);

    rerender({
      baseUrl: "https://example.com",
      accessToken: null,
      guestAllowed: true,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual(initialEntries);
    expect(vibeusageApi.getProjectUsageSummary).toHaveBeenCalledTimes(1);
  });
});
