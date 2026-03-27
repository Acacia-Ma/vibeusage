import { describe, expect, it } from "vitest";

import {
  getUsagePanelLoading,
  selectRollingUsageForDisplay,
} from "./dashboard-period-bindings";

describe("dashboard period bindings", () => {
  it("uses only usage loading for the CORE_INDEX panel", () => {
    expect(
      getUsagePanelLoading({
        usageLoading: false,
        trendLoading: true,
        heatmapLoading: true,
        modelBreakdownLoading: true,
      }),
    ).toBe(false);
  });

  it("prefers independent recent usage data over period-scoped rolling usage", () => {
    const recentRolling = {
      last_7d: { totals: { billable_total_tokens: "recent-stable" } },
    };
    const usageRolling = {
      last_7d: { totals: { billable_total_tokens: "week-period" } },
    };

    expect(selectRollingUsageForDisplay({ recentRolling, usageRolling })).toEqual(recentRolling);
  });
});
