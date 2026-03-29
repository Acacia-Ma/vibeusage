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

    expect(selectRollingUsageForDisplay({ recentRolling })).toEqual(recentRolling);
  });

  it("does not fall back to period-scoped rolling usage when recent usage is unavailable", () => {
    expect(
      selectRollingUsageForDisplay({
        recentRolling: null,
      }),
    ).toBeNull();
  });
});
