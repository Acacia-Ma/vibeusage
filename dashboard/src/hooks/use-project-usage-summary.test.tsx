import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectUsageSummary } from "./use-project-usage-summary";

type ProjectUsageEntry = {
  project_key: string;
  project_ref: string;
  total_tokens: string;
};

type ProjectUsageSummaryResponse = {
  entries: ProjectUsageEntry[];
};

type HookProps = {
  baseUrl: string;
  accessToken: string | null;
  guestAllowed: boolean;
  from?: string;
  to?: string;
};

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const mockData = vi.hoisted(() => ({
  isMockEnabled: vi.fn(() => false),
}));

const vibeusageApi = vi.hoisted(() => ({
  getProjectUsageSummary: vi.fn<(...args: any[]) => Promise<ProjectUsageSummaryResponse>>(
    async () => ({ entries: [] }),
  ),
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
    const initialEntries: ProjectUsageEntry[] = [
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        total_tokens: "42",
      },
    ];

    vibeusageApi.getProjectUsageSummary.mockResolvedValueOnce({ entries: initialEntries });

    const initialProps: HookProps = {
      baseUrl: "https://example.com",
      accessToken: "token",
      guestAllowed: false,
    };

    const { result, rerender } = renderHook((props: HookProps) => useProjectUsageSummary(props), {
      initialProps,
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

  it("clears stale entries immediately when the requested range changes", async () => {
    const initialEntries: ProjectUsageEntry[] = [
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        total_tokens: "42",
      },
    ];
    const nextEntries: ProjectUsageEntry[] = [
      {
        project_key: "acme/beta",
        project_ref: "https://github.com/acme/beta",
        total_tokens: "84",
      },
    ];

    const nextRequest = {
      resolve: null as ((value: ProjectUsageSummaryResponse) => void) | null,
    };

    vibeusageApi.getProjectUsageSummary
      .mockResolvedValueOnce({ entries: initialEntries })
      .mockImplementationOnce(
        () =>
          new Promise<ProjectUsageSummaryResponse>((resolve) => {
            nextRequest.resolve = resolve;
          }),
      );

    const { result, rerender } = renderHook((props: HookProps) => useProjectUsageSummary(props), {
      initialProps: {
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-01",
        to: "2026-03-07",
      },
    });

    await waitFor(() => expect(result.current.entries).toEqual(initialEntries));

    await act(async () => {
      rerender({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-08",
        to: "2026-03-14",
      });
    });

    await waitFor(() => expect(result.current.entries).toEqual([]));
    expect(result.current.error).toBeNull();

    await act(async () => {
      if (nextRequest.resolve) {
        nextRequest.resolve({ entries: nextEntries });
      }
    });

    await waitFor(() => expect(result.current.entries).toEqual(nextEntries));
  });

  it("enters loading immediately when the requested range changes", async () => {
    const initialEntries: ProjectUsageEntry[] = [
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        total_tokens: "42",
      },
    ];

    const pendingToken = {
      release: null as ((value: string | null) => void) | null,
    };

    vibeusageApi.getProjectUsageSummary.mockResolvedValueOnce({ entries: initialEntries });

    const { result, rerender } = renderHook((props: HookProps) => useProjectUsageSummary(props), {
      initialProps: {
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-01",
        to: "2026-03-07",
      },
    });

    await waitFor(() => expect(result.current.entries).toEqual(initialEntries));

    authToken.resolveAuthAccessToken.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          pendingToken.release = resolve;
        }),
    );

    await act(async () => {
      rerender({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-08",
        to: "2026-03-14",
      });
    });

    await waitFor(() => expect(result.current.entries).toEqual([]));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      if (pendingToken.release) {
        pendingToken.release("token");
      }
    });
  });
});
