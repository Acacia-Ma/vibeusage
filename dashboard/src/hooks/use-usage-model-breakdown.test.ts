import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUsageModelBreakdown } from "./use-usage-model-breakdown";

type BreakdownResponse = {
  models?: any[];
};

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const dashboardCache = vi.hoisted(() => ({
  buildDashboardCacheKey: vi.fn(() => "breakdown-cache-key"),
  clearDashboardCache: vi.fn(),
  readDashboardCache: vi.fn(() => null as any),
  writeDashboardCache: vi.fn(),
}));

const liveSnapshots = vi.hoisted(() => ({
  readDashboardLiveSnapshot: vi.fn(() => null as any),
  writeDashboardLiveSnapshot: vi.fn(),
}));

const mockData = vi.hoisted(() => ({
  isMockEnabled: vi.fn(() => false),
}));

const timezone = vi.hoisted(() => ({
  getTimeZoneCacheKey: vi.fn(() => "tz:utc"),
}));

const vibeusageApi = vi.hoisted(() => ({
  getUsageModelBreakdown: vi.fn(async () => ({ models: [] } as BreakdownResponse)),
}));

vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/dashboard-cache", () => dashboardCache);
vi.mock("../lib/dashboard-live-snapshot", () => liveSnapshots);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/timezone", () => timezone);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);

describe("useUsageModelBreakdown", () => {
  afterEach(() => {
    authToken.isAccessTokenReady.mockReset();
    authToken.isAccessTokenReady.mockImplementation((token: any) => Boolean(token));
    authToken.resolveAuthAccessToken.mockReset();
    authToken.resolveAuthAccessToken.mockImplementation(async (token: any) => token ?? null);

    dashboardCache.buildDashboardCacheKey.mockReset();
    dashboardCache.buildDashboardCacheKey.mockReturnValue("breakdown-cache-key");
    dashboardCache.clearDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReturnValue(null);
    dashboardCache.writeDashboardCache.mockReset();
    liveSnapshots.readDashboardLiveSnapshot.mockReset();
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue(null);
    liveSnapshots.writeDashboardLiveSnapshot.mockReset();

    mockData.isMockEnabled.mockReset();
    mockData.isMockEnabled.mockReturnValue(false);

    timezone.getTimeZoneCacheKey.mockReset();
    timezone.getTimeZoneCacheKey.mockReturnValue("tz:utc");

    vibeusageApi.getUsageModelBreakdown.mockReset();
    vibeusageApi.getUsageModelBreakdown.mockResolvedValue({ models: [] } as BreakdownResponse);
  });

  it("does not hydrate cached model breakdown data before the backend refresh resolves", async () => {
    dashboardCache.readDashboardCache.mockReturnValue({
      breakdown: { models: [{ label: "cached", value: "11" }] },
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });

    let resolveBreakdown: ((value: any) => void) | null = null;
    vibeusageApi.getUsageModelBreakdown.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBreakdown = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useUsageModelBreakdown({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-01",
        to: "2026-03-07",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageModelBreakdown).toHaveBeenCalledTimes(1));

    expect(result.current.loading).toBe(true);
    expect(result.current.source).toBe("edge");
    expect(result.current.breakdown).toBeNull();

    const nextBreakdown = { models: [{ label: "edge", value: "42" }] };
    await act(async () => {
      resolveBreakdown?.(nextBreakdown);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.breakdown).toEqual(nextBreakdown);
  });

  it("keeps the previous model breakdown visible while a new period refresh is in flight", async () => {
    const resolvers: Array<(value: any) => void> = [];
    vibeusageApi.getUsageModelBreakdown.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { result, rerender } = renderHook(
      (props) =>
        useUsageModelBreakdown({
          baseUrl: "https://example.com",
          accessToken: "token",
          guestAllowed: false,
          cacheKey: "user-1",
          timeZone: "UTC",
          tzOffsetMinutes: 0,
          ...props,
        }),
      {
        initialProps: {
          from: "2026-03-01",
          to: "2026-03-07",
        },
      },
    );

    await waitFor(() => expect(vibeusageApi.getUsageModelBreakdown).toHaveBeenCalledTimes(1));

    const previousBreakdown = { models: [{ label: "edge", value: "42" }] };
    await act(async () => {
      resolvers.shift()?.(previousBreakdown);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.breakdown).toEqual(previousBreakdown);

    rerender({
      from: "2026-02-01",
      to: "2026-02-07",
    });

    await waitFor(() => expect(vibeusageApi.getUsageModelBreakdown).toHaveBeenCalledTimes(2));
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.breakdown).toEqual(previousBreakdown);
  });

  it("hydrates a resolved model breakdown snapshot immediately while refreshing in the background", async () => {
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue({
      breakdown: {
        sources: [
          {
            source: "claude",
            models: [
              {
                model: "anthropic/claude-sonnet-4.6",
                model_id: "anthropic/claude-sonnet-4.6",
                totals: { billable_total_tokens: 84 },
              },
            ],
          },
        ],
      },
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });

    let resolveBreakdown: ((value: any) => void) | null = null;
    vibeusageApi.getUsageModelBreakdown.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBreakdown = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useUsageModelBreakdown({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-01",
        to: "2026-03-07",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
      }),
    );

    await waitFor(() =>
      expect(result.current.breakdown).toEqual({
        sources: [
          {
            source: "claude",
            models: [
              {
                model: "anthropic/claude-sonnet-4.6",
                display_model: "claude-sonnet-4.6",
                model_id: "anthropic/claude-sonnet-4.6",
                totals: { billable_total_tokens: 84 },
              },
            ],
          },
        ],
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.source).toBe("edge");
    expect(result.current.fetchedAt).toBe("2026-03-07T00:00:00.000Z");

    const nextBreakdown = { models: [{ label: "edge", value: "126" }] };
    await act(async () => {
      resolveBreakdown?.(nextBreakdown);
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.breakdown).toEqual(nextBreakdown);
  });

  it("hydrates cached model breakdown entries with derived display_model when refresh fails", async () => {
    dashboardCache.readDashboardCache.mockReturnValue({
      breakdown: {
        sources: [
          {
            source: "claude",
            models: [
              {
                model: "anthropic/claude-opus-4.6",
                model_id: "anthropic/claude-opus-4.6",
                totals: { billable_total_tokens: 51 },
              },
            ],
          },
        ],
      },
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });
    vibeusageApi.getUsageModelBreakdown.mockRejectedValue(new Error("Unauthorized"));

    const { result } = renderHook(() =>
      useUsageModelBreakdown({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        from: "2026-03-01",
        to: "2026-03-07",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.source).toBe("cache");
    expect(result.current.fetchedAt).toBe("2026-03-07T00:00:00.000Z");
    expect(result.current.breakdown).toEqual({
      sources: [
        {
          source: "claude",
          models: [
            {
              model: "anthropic/claude-opus-4.6",
              display_model: "claude-opus-4.6",
              model_id: "anthropic/claude-opus-4.6",
              totals: { billable_total_tokens: 51 },
            },
          ],
        },
      ],
    });
  });
});
