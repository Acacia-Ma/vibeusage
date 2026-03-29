import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "../../../../test/test-utils";
import { ActivityHeatmap } from "../ActivityHeatmap.jsx";

describe("ActivityHeatmap", () => {
  it("renders the backend week grid directly without rebuilding extra weeks", () => {
    const heatmap = {
      to: "2026-03-07",
      week_starts_on: "sun",
      weeks: [
        [
          { day: "2026-03-01", value: 1, level: 1 },
          { day: "2026-03-02", value: 2, level: 2 },
          null,
          null,
          null,
          null,
          null,
        ],
      ],
    };

    const { container } = render(React.createElement(ActivityHeatmap, { heatmap }));

    expect(container.querySelectorAll("[title]")).toHaveLength(2);
  });
});
