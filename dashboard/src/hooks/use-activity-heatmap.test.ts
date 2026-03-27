import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useActivityHeatmap } from "./use-activity-heatmap";

const NOW = new Date("2026-03-07T00:00:00Z");

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const dashboardCache = vi.hoisted(() => ({
  buildDashboardCacheKey: vi.fn(() => "heatmap-cache-key"),
  clearDashboardCache: vi.fn(),
  readDashboardCache: vi.fn(() => null as any),
  writeDashboardCache: vi.fn(),
}));

const mockData = vi.hoisted(() => ({
  isMockEnabled: vi.fn(() => false),
}));

const timezone = vi.hoisted(() => ({
  getTimeZoneCacheKey: vi.fn(() => "tz:utc"),
}));

type HeatmapResponse = {
  to?: string;
  week_starts_on?: string;
  active_days?: number;
  streak_days?: number;
  weeks: any[];
};

const vibeusageApi = vi.hoisted(() => ({
  getUsageDaily: vi.fn(async () => ({ data: [] })),
  getUsageHeatmap: vi.fn(async () => ({ weeks: [] } as HeatmapResponse)),
}));

vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/dashboard-cache", () => dashboardCache);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/timezone", () => timezone);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);

describe("useActivityHeatmap", () => {
  afterEach(() => {
    authToken.isAccessTokenReady.mockReset();
    authToken.isAccessTokenReady.mockImplementation((token: any) => Boolean(token));
    authToken.resolveAuthAccessToken.mockReset();
    authToken.resolveAuthAccessToken.mockImplementation(async (token: any) => token ?? null);

    dashboardCache.buildDashboardCacheKey.mockReset();
    dashboardCache.buildDashboardCacheKey.mockReturnValue("heatmap-cache-key");
    dashboardCache.clearDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReturnValue(null);
    dashboardCache.writeDashboardCache.mockReset();

    mockData.isMockEnabled.mockReset();
    mockData.isMockEnabled.mockReturnValue(false);

    timezone.getTimeZoneCacheKey.mockReset();
    timezone.getTimeZoneCacheKey.mockReturnValue("tz:utc");

    vibeusageApi.getUsageDaily.mockReset();
    vibeusageApi.getUsageDaily.mockResolvedValue({ data: [] });
    vibeusageApi.getUsageHeatmap.mockReset();
    vibeusageApi.getUsageHeatmap.mockResolvedValue({ weeks: [] } as HeatmapResponse);
  });

  it("uses the backend heatmap payload directly without a daily fallback request", async () => {
    const heatmapPayload = {
      to: "2026-03-07",
      week_starts_on: "sun",
      active_days: 1,
      streak_days: 1,
      weeks: [[{ day: "2026-03-07", value: 42, level: 3 }]],
    };
    vibeusageApi.getUsageHeatmap.mockResolvedValueOnce(heatmapPayload);

    const { result } = renderHook(() =>
      useActivityHeatmap({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        weeks: 1,
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: NOW,
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageHeatmap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.heatmap).toEqual(heatmapPayload));

    expect(vibeusageApi.getUsageDaily).not.toHaveBeenCalled();
    expect(result.current.source).toBe("edge");
  });

  it("does not hydrate cached heatmap data before the backend refresh resolves", async () => {
    dashboardCache.readDashboardCache.mockReturnValue({
      heatmap: {
        to: "2026-03-07",
        week_starts_on: "sun",
        weeks: [[{ day: "2026-03-07", value: 11, level: 1 }]],
      },
      daily: [{ day: "2026-03-07", total_tokens: "11" }],
    });

    let resolveHeatmap: ((value: any) => void) | null = null;
    vibeusageApi.getUsageHeatmap.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHeatmap = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useActivityHeatmap({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        weeks: 1,
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: NOW,
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageHeatmap).toHaveBeenCalledTimes(1));

    expect(result.current.loading).toBe(true);
    expect(result.current.source).toBe("edge");
    expect(result.current.heatmap).toBeNull();

    const heatmapPayload = {
      to: "2026-03-07",
      week_starts_on: "sun",
      active_days: 1,
      streak_days: 1,
      weeks: [[{ day: "2026-03-07", value: 42, level: 3 }]],
    };

    await act(async () => {
      resolveHeatmap?.(heatmapPayload);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.heatmap).toEqual(heatmapPayload);
  });

  it("keeps the previous heatmap visible while a refresh is in flight", async () => {
    const resolvers: Array<(value: any) => void> = [];
    vibeusageApi.getUsageHeatmap.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { result, rerender } = renderHook(
      (props) =>
        useActivityHeatmap({
          baseUrl: "https://example.com",
          accessToken: "token",
          guestAllowed: false,
          cacheKey: "user-1",
          timeZone: "UTC",
          tzOffsetMinutes: 0,
          now: NOW,
          ...props,
        }),
      {
        initialProps: {
          weeks: 1,
        },
      },
    );

    await waitFor(() => expect(vibeusageApi.getUsageHeatmap).toHaveBeenCalledTimes(1));

    const previousHeatmap = {
      to: "2026-03-07",
      week_starts_on: "sun",
      weeks: [[{ day: "2026-03-07", value: 42, level: 3 }]],
    };

    await act(async () => {
      resolvers.shift()?.(previousHeatmap);
    });

    await waitFor(() => expect(result.current.heatmap).toEqual(previousHeatmap));
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({
      weeks: 2,
    });

    await waitFor(() => expect(vibeusageApi.getUsageHeatmap).toHaveBeenCalledTimes(2));
    expect(result.current.loading).toBe(true);
    expect(result.current.heatmap).toEqual(previousHeatmap);
  });
});
