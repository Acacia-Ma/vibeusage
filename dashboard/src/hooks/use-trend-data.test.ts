import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTrendData } from "./use-trend-data";

const NOW = new Date("2026-03-07T00:00:00Z");

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const dashboardCache = vi.hoisted(() => ({
  buildDashboardCacheKey: vi.fn(() => "trend-cache-key"),
  clearDashboardCache: vi.fn(),
  readDashboardCache: vi.fn(() => null as any),
  writeDashboardCache: vi.fn(),
}));

const mockData = vi.hoisted(() => ({
  isMockEnabled: vi.fn(() => false),
}));

const timezone = vi.hoisted(() => ({
  getLocalDayKey: vi.fn(() => "2026-03-07"),
  getTimeZoneCacheKey: vi.fn(() => "tz:utc"),
}));

const vibeusageApi = vi.hoisted(() => ({
  getUsageDaily: vi.fn(async () => ({ from: "2026-03-07", to: "2026-03-07", data: [] })),
  getUsageHourly: vi.fn(async () => ({ day: "2026-03-07", data: [] })),
  getUsageMonthly: vi.fn(async () => ({ from: "2026-03", to: "2026-03", data: [] })),
}));

vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/dashboard-cache", () => dashboardCache);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/timezone", () => timezone);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);

describe("useTrendData", () => {
  afterEach(() => {
    authToken.isAccessTokenReady.mockReset();
    authToken.isAccessTokenReady.mockImplementation((token: any) => Boolean(token));
    authToken.resolveAuthAccessToken.mockReset();
    authToken.resolveAuthAccessToken.mockImplementation(async (token: any) => token ?? null);

    dashboardCache.buildDashboardCacheKey.mockReset();
    dashboardCache.buildDashboardCacheKey.mockReturnValue("trend-cache-key");
    dashboardCache.clearDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReturnValue(null);
    dashboardCache.writeDashboardCache.mockReset();

    mockData.isMockEnabled.mockReset();
    mockData.isMockEnabled.mockReturnValue(false);

    timezone.getLocalDayKey.mockReset();
    timezone.getLocalDayKey.mockReturnValue("2026-03-07");
    timezone.getTimeZoneCacheKey.mockReset();
    timezone.getTimeZoneCacheKey.mockReturnValue("tz:utc");

    vibeusageApi.getUsageDaily.mockReset();
    vibeusageApi.getUsageDaily.mockResolvedValue({
      from: "2026-03-07",
      to: "2026-03-07",
      data: [],
    });
    vibeusageApi.getUsageHourly.mockReset();
    vibeusageApi.getUsageHourly.mockResolvedValue({ day: "2026-03-07", data: [] });
    vibeusageApi.getUsageMonthly.mockReset();
    vibeusageApi.getUsageMonthly.mockResolvedValue({
      from: "2026-03",
      to: "2026-03",
      data: [],
    });
  });

  it("fetches week trend data from usage-daily instead of another hook's rows", async () => {
    const { result } = renderHook(() =>
      useTrendData({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        period: "week",
        from: "2026-03-07",
        to: "2026-03-07",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: NOW,
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageDaily).toHaveBeenCalledTimes(1));

    expect(vibeusageApi.getUsageHourly).not.toHaveBeenCalled();
    expect(vibeusageApi.getUsageMonthly).not.toHaveBeenCalled();
    expect(result.current.source).toBe("edge");
  });

  it("does not hydrate trend rows from cache before the backend refresh resolves", async () => {
    dashboardCache.readDashboardCache.mockReturnValue({
      rows: [{ day: "2026-03-07", total_tokens: "11", billable_total_tokens: "11" }],
      from: "2026-03-07",
      to: "2026-03-07",
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });

    let resolveDaily: ((value: any) => void) | null = null;
    vibeusageApi.getUsageDaily.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDaily = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useTrendData({
        baseUrl: "https://example.com",
        accessToken: "token",
        guestAllowed: false,
        period: "week",
        from: "2026-03-07",
        to: "2026-03-07",
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: NOW,
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageDaily).toHaveBeenCalledTimes(1));

    expect(result.current.loading).toBe(true);
    expect(result.current.source).toBe("edge");
    expect(result.current.rows).toEqual([]);

    await act(async () => {
      resolveDaily?.({
        from: "2026-03-07",
        to: "2026-03-07",
        data: [{ day: "2026-03-07", total_tokens: "42", billable_total_tokens: "42" }],
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([
      expect.objectContaining({
        day: "2026-03-07",
        total_tokens: "42",
        billable_total_tokens: "42",
      }),
    ]);
  });
});
