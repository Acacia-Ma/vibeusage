import React from "react";
import { copy } from "../../../lib/copy";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";

export const TopModelsPanel = React.memo(function TopModelsPanel({ rows = [], className = "" }) {
  const placeholder = copy("shared.placeholder.short");
  const percentSymbol = copy("shared.unit.percent");
  const displayRows = Array.from({ length: 3 }, (_, index) => {
    const row = rows[index];
    if (row) return row;
    return { id: "", name: "", percent: "", empty: true };
  });

  return (
    <AsciiBox
      title={copy("dashboard.top_models.title")}
      subtitle={copy("dashboard.top_models.subtitle")}
      className={className}
    >
      {/* Win2K list view */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th
              className="win-listview-header"
              style={{ textAlign: "center", width: 28 }}
            >
              #
            </th>
            <th className="win-listview-header" style={{ textAlign: "left" }}>
              Model
            </th>
            <th
              className="win-listview-header"
              style={{ textAlign: "right", width: 56 }}
            >
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, index) => {
            const isEmpty = Boolean(row?.empty);
            const name = isEmpty ? "" : row?.name ? String(row.name) : placeholder;
            const percent = isEmpty ? "" : row?.percent ? String(row.percent) : placeholder;
            const showPercentSymbol = !isEmpty && percent !== placeholder;
            const rowKey = row?.id ? String(row.id) : `${name}-${index}`;

            return (
              <tr key={rowKey} className="win-listview-row">
                <td
                  style={{
                    padding: "2px 4px",
                    textAlign: "center",
                    color: "var(--win-dark)",
                    fontWeight: "bold",
                    borderRight: "1px solid var(--win-btn-shadow)",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td
                  style={{
                    padding: "2px 6px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 0,
                  }}
                >
                  {name}
                </td>
                <td
                  style={{
                    padding: "2px 6px",
                    textAlign: "right",
                    fontWeight: "bold",
                    color: "var(--win-navy, #000080)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {percent}
                  {showPercentSymbol ? percentSymbol : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AsciiBox>
  );
});
