import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUsageData } from "./use-usage-data";

const authToken = vi.hoisted(() => ({
  isAccessTokenReady: vi.fn((token: any) => Boolean(token)),
  resolveAuthAccessToken: vi.fn(async (token: any) => token ?? null),
}));

const dashboardCache = vi.hoisted(() => ({
  buildDashboardCacheKey: vi.fn(() => "usage-cache-key"),
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
  getLocalDayKey: vi.fn(({ date }: any = {}) => {
    const value = date instanceof Date ? date : new Date("2026-03-07T00:00:00Z");
    return value.toISOString().slice(0, 10);
  }),
  getTimeZoneCacheKey: vi.fn(() => "tz:utc"),
}));

const vibeusageApi = vi.hoisted(() => ({
  getUsageDaily: vi.fn(async () => ({ data: [] })),
  getUsageSummary: vi.fn(async () => ({ totals: null, rolling: null })),
}));

vi.mock("../lib/auth-token", () => authToken);
vi.mock("../lib/dashboard-cache", () => dashboardCache);
vi.mock("../lib/dashboard-live-snapshot", () => liveSnapshots);
vi.mock("../lib/mock-data", () => mockData);
vi.mock("../lib/timezone", () => timezone);
vi.mock("../lib/vibeusage-api", () => vibeusageApi);

describe("useUsageData", () => {
  afterEach(() => {
    authToken.isAccessTokenReady.mockReset();
    authToken.isAccessTokenReady.mockImplementation((token: any) => Boolean(token));
    authToken.resolveAuthAccessToken.mockReset();
    authToken.resolveAuthAccessToken.mockImplementation(async (token: any) => token ?? null);

    dashboardCache.buildDashboardCacheKey.mockReset();
    dashboardCache.buildDashboardCacheKey.mockReturnValue("usage-cache-key");
    dashboardCache.clearDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReset();
    dashboardCache.readDashboardCache.mockReturnValue(null);
    dashboardCache.writeDashboardCache.mockReset();

    liveSnapshots.readDashboardLiveSnapshot.mockReset();
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue(null);
    liveSnapshots.writeDashboardLiveSnapshot.mockReset();

    mockData.isMockEnabled.mockReset();
    mockData.isMockEnabled.mockReturnValue(false);

    timezone.getLocalDayKey.mockReset();
    timezone.getLocalDayKey.mockImplementation(({ date }: any = {}) => {
      const value = date instanceof Date ? date : new Date("2026-03-07T00:00:00Z");
      return value.toISOString().slice(0, 10);
    });
    timezone.getTimeZoneCacheKey.mockReset();
    timezone.getTimeZoneCacheKey.mockReturnValue("tz:utc");

    vibeusageApi.getUsageDaily.mockReset();
    vibeusageApi.getUsageDaily.mockResolvedValue({ data: [] });
    vibeusageApi.getUsageSummary.mockReset();
    vibeusageApi.getUsageSummary.mockResolvedValue({ totals: null, rolling: null });
  });

  it("updates summary as soon as summary data resolves without waiting for daily rows", async () => {
    const dailyResolvers = [] as ((value: any) => void)[];
    const summaryResolvers = [] as ((value: any) => void)[];

    vibeusageApi.getUsageDaily.mockImplementation(
      () =>
        new Promise((resolve) => {
          dailyResolvers.push(resolve);
        }),
    );
    vibeusageApi.getUsageSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          summaryResolvers.push(resolve);
        }),
    );

    const { result } = renderHook(() =>
      useUsageData({
        baseUrl: "https://example.com",
        accessToken: "token",
        from: "2026-03-01",
        to: "2026-03-07",
        includeDaily: true,
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: new Date("2026-03-07T00:00:00Z"),
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageDaily).toHaveBeenCalled());
    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalled());

    await act(async () => {
      for (const resolve of summaryResolvers) {
        resolve({
          totals: { total_tokens: "42", billable_total_tokens: "42" },
          rolling: { last_7d: { totals: { billable_total_tokens: "42" } } },
        });
      }
    });

    await waitFor(() =>
      expect(result.current.summary).toEqual({
        total_tokens: "42",
        billable_total_tokens: "42",
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      for (const resolve of dailyResolvers) {
        resolve({
          data: [{ day: "2026-03-07", total_tokens: "42", billable_total_tokens: "42" }],
        });
      }
    });

    await waitFor(() =>
      expect(result.current.summary).toEqual({
        total_tokens: "42",
        billable_total_tokens: "42",
      }),
    );
  });

  it("does not hydrate usage from cache before the edge refresh resolves", async () => {
    dashboardCache.readDashboardCache.mockReturnValue({
      summary: { total_tokens: "11", billable_total_tokens: "11" },
      rolling: { last_7d: { totals: { billable_total_tokens: "11" } } },
      daily: [{ day: "2026-03-07", total_tokens: "11", billable_total_tokens: "11" }],
      from: "2026-03-01",
      to: "2026-03-07",
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });

    const dailyResolvers = [] as ((value: any) => void)[];
    const summaryResolvers = [] as ((value: any) => void)[];

    vibeusageApi.getUsageDaily.mockImplementation(
      () =>
        new Promise((resolve) => {
          dailyResolvers.push(resolve);
        }),
    );
    vibeusageApi.getUsageSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          summaryResolvers.push(resolve);
        }),
    );

    const { result } = renderHook(() =>
      useUsageData({
        baseUrl: "https://example.com",
        accessToken: "token",
        from: "2026-03-01",
        to: "2026-03-07",
        includeDaily: true,
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: new Date("2026-03-07T00:00:00Z"),
      }),
    );

    await waitFor(() => expect(vibeusageApi.getUsageDaily).toHaveBeenCalled());
    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalled());

    expect(result.current.loading).toBe(true);
    expect(result.current.source).toBe("edge");
    expect(result.current.summary).toBeNull();
    expect(result.current.daily).toEqual([]);

    await act(async () => {
      for (const resolve of summaryResolvers) {
        resolve({
          totals: { total_tokens: "42", billable_total_tokens: "42" },
          rolling: { last_7d: { totals: { billable_total_tokens: "42" } } },
        });
      }
    });

    await waitFor(() =>
      expect(result.current.summary).toEqual({
        total_tokens: "42",
        billable_total_tokens: "42",
      }),
    );

    await act(async () => {
      for (const resolve of dailyResolvers) {
        resolve({
          data: [{ day: "2026-03-07", total_tokens: "42", billable_total_tokens: "42" }],
        });
      }
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("hydrates a resolved period snapshot immediately before the next backend summary arrives", async () => {
    liveSnapshots.readDashboardLiveSnapshot.mockReturnValue({
      summary: { total_tokens: "84", billable_total_tokens: "84" },
      rolling: { last_7d: { totals: { billable_total_tokens: "84" } } },
      daily: [{ day: "2026-03-07", total_tokens: "84", billable_total_tokens: "84" }],
      fetchedAt: "2026-03-07T00:00:00.000Z",
    });

    const dailyResolvers = [] as ((value: any) => void)[];
    const summaryResolvers = [] as ((value: any) => void)[];

    vibeusageApi.getUsageDaily.mockImplementation(
      () =>
        new Promise((resolve) => {
          dailyResolvers.push(resolve);
        }),
    );
    vibeusageApi.getUsageSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          summaryResolvers.push(resolve);
        }),
    );

    const { result } = renderHook(() =>
      useUsageData({
        baseUrl: "https://example.com",
        accessToken: "token",
        from: "2026-03-01",
        to: "2026-03-07",
        includeDaily: true,
        cacheKey: "user-1",
        timeZone: "UTC",
        tzOffsetMinutes: 0,
        now: new Date("2026-03-07T00:00:00Z"),
      }),
    );

    await waitFor(() =>
      expect(result.current.summary).toEqual({
        total_tokens: "84",
        billable_total_tokens: "84",
      }),
    );
    await waitFor(() => expect(vibeusageApi.getUsageSummary).toHaveBeenCalled());
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      for (const resolve of summaryResolvers) {
        resolve({
          totals: { total_tokens: "126", billable_total_tokens: "126" },
          rolling: { last_7d: { totals: { billable_total_tokens: "126" } } },
        });
      }
      for (const resolve of dailyResolvers) {
        resolve({
          data: [{ day: "2026-03-07", total_tokens: "126", billable_total_tokens: "126" }],
        });
      }
    });

    await waitFor(() =>
      expect(vibeusageApi.getUsageSummary).toHaveBeenCalled(),
    );
  });
});
