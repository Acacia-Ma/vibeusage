import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../../../test/test-utils";
import { UsagePanel } from "../UsagePanel.jsx";

describe("UsagePanel", () => {
  it("shows a visible summary loading placeholder when total summary is pending", () => {
    render(
      <UsagePanel
        period="total"
        periods={["day", "week", "month", "total"]}
        showSummary
        useSummaryLayout
        summaryLabel="TOTAL_TOKENS"
        summaryValue="—"
        loading
      />,
    );

    expect(screen.getByTestId("usage-summary-loading")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("keeps the current summary visible while a background refresh is in flight", () => {
    render(
      <UsagePanel
        period="total"
        periods={["day", "week", "month", "total"]}
        showSummary
        useSummaryLayout
        summaryLabel="TOTAL_TOKENS"
        summaryValue="84B"
        summaryAnimate={false}
        refreshing
        onRefresh={() => {}}
      />,
    );

    expect(screen.queryByTestId("usage-summary-loading")).not.toBeInTheDocument();
    expect(screen.getByText("84B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });
});
