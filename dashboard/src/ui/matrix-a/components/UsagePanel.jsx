import { Button } from "@base-ui/react/button";
import React from "react";
import { copy } from "../../../lib/copy";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";
import { MatrixButton } from "../../foundation/MatrixButton.jsx";

function normalizePeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods.map((p) => {
    if (typeof p === "string") {
      return { key: p, label: p.toUpperCase() };
    }
    return { key: p.key, label: p.label || String(p.key).toUpperCase() };
  });
}

export const UsagePanel = React.memo(function UsagePanel({
  title = copy("usage.panel.title"),
  period,
  periods,
  onPeriodChange,
  metrics = [],
  showSummary = false,
  summaryLabel = copy("usage.summary.total_system_output"),
  summaryValue = "—",
  summaryCostValue,
  onCostInfo,
  costInfoLabel = copy("usage.cost_info.label"),
  costInfoIcon = copy("usage.cost_info.icon"),
  summarySubLabel,
  breakdown,
  breakdownCollapsed = false,
  onToggleBreakdown,
  collapseLabel,
  expandLabel,
  collapseAriaLabel,
  expandAriaLabel,
  useSummaryLayout = false,
  onRefresh,
  loading = false,
  refreshing = false,
  error,
  rangeLabel,
  rangeTimeZoneLabel,
  statusLabel,
  summaryAnimate = true,
  summaryScrambleDurationMs = 2200,
  hideHeader = false,
  className = "",
}) {
  const tabs = normalizePeriods(periods);
  const toggleLabel = breakdownCollapsed ? expandLabel : collapseLabel;
  const toggleAriaLabel = breakdownCollapsed ? expandAriaLabel : collapseAriaLabel;
  const showBreakdownToggle = Boolean(onToggleBreakdown && toggleLabel);
  const showSummaryLoadingPlaceholder = loading && (!summaryValue || summaryValue === "—");

  const costLabelText = typeof costInfoIcon === "string" ? costInfoIcon : "";
  const costLabelMatch = costLabelText.match(/^\[\s*(.+?)\s*\]$/);
  const costLabelCore = costLabelMatch ? costLabelMatch[1] : null;

  let summaryDisplay = summaryValue;
  if (showSummaryLoadingPlaceholder) {
    summaryDisplay = (
      <span
        className="inline-flex items-center justify-center"
        data-testid="usage-summary-loading"
        aria-label={copy("usage.button.loading")}
        style={{
          width: 120,
          height: 32,
          background: "var(--win-sunken)",
          border: "1px solid var(--win-btn-dark-shadow)",
        }}
      >
        <span className="sr-only">{copy("usage.button.loading")}</span>
      </span>
    );
  }

  const breakdownRows =
    breakdown && breakdown.length
      ? breakdown
      : [
          { key: copy("usage.metric.input"), label: copy("usage.metric.input") },
          { key: copy("usage.metric.output"), label: copy("usage.metric.output") },
          { key: copy("usage.metric.cached_input"), label: copy("usage.metric.cached_short") },
          { key: copy("usage.metric.reasoning_output"), label: copy("usage.metric.reasoning_short") },
        ]
          .map((item) => {
            const match = metrics.find((row) => row.label === item.key);
            if (!match) return null;
            return { label: item.label, value: match.value };
          })
          .filter(Boolean);

  return (
    <AsciiBox title={title} className={className}>
      {!hideHeader ? (
        <div
          className="flex flex-wrap items-center justify-between mb-2 pb-2 gap-2"
          style={{ borderBottom: "1px solid var(--win-btn-shadow)" }}
        >
          {/* Period tabs — Win2K tab strip */}
          <div className="flex items-end gap-0" style={{ borderBottom: "none" }}>
            {tabs.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onPeriodChange?.(p.key)}
                className={`win-tab ${period === p.key ? "win-tab--active" : "win-tab--inactive"}`}
                style={{
                  fontSize: 11,
                  fontFamily: '"Tahoma", "MS Sans Serif", sans-serif',
                  cursor: "default",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {statusLabel ? (
              <span
                className="flex items-center gap-1"
                style={{ fontSize: 11, color: "var(--win-green)" }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    background: "var(--win-green)",
                    border: "1px solid var(--win-btn-dark-shadow)",
                  }}
                />
                {statusLabel}
              </span>
            ) : null}
            {showBreakdownToggle ? (
              <MatrixButton
                aria-label={toggleAriaLabel}
                title={toggleAriaLabel}
                onClick={onToggleBreakdown}
              >
                {toggleLabel}
              </MatrixButton>
            ) : null}
            {onRefresh ? (
              <MatrixButton primary disabled={loading || refreshing} onClick={onRefresh}>
                {loading || refreshing ? copy("usage.button.loading") : copy("usage.button.refresh")}
              </MatrixButton>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="text-[11px] px-2 py-1 mb-2"
          style={{
            color: "var(--win-danger)",
            background: "var(--win-danger-bg)",
            border: "1px solid var(--win-danger)",
          }}
        >
          {copy("shared.error.prefix", { error })}
        </div>
      ) : null}

      {showSummary || useSummaryLayout ? (
        <div className="flex flex-col items-center py-4 gap-4">
          <div className="text-center">
            <div
              className="mb-1"
              style={{ fontSize: 11, color: "var(--win-text)", fontWeight: "bold" }}
            >
              {summaryLabel}
            </div>
            <div
              className="tabular-nums leading-none select-none"
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: "bold",
                color: "var(--win-navy)",
                fontFamily: '"Tahoma", "MS Sans Serif", sans-serif',
              }}
            >
              {summaryDisplay}
            </div>
            {summaryCostValue ? (
              <div className="flex items-center justify-center gap-2 mt-3">
                <span
                  className="leading-none"
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "var(--win-navy)",
                  }}
                >
                  {summaryCostValue}
                </span>
                {onCostInfo ? (
                  <Button
                    type="button"
                    onClick={onCostInfo}
                    title={costInfoLabel}
                    aria-label={costInfoLabel}
                    className="win-btn"
                    style={{
                      fontSize: 10,
                      minWidth: 0,
                      padding: "1px 6px",
                      minHeight: 18,
                      background: "var(--win-btn-face)",
                      fontFamily: '"Tahoma", sans-serif',
                    }}
                  >
                    {costLabelCore || costInfoIcon}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {summarySubLabel ? (
              <div className="mt-1 text-[11px]" style={{ color: "var(--win-dark)" }}>
                {summarySubLabel}
              </div>
            ) : null}
          </div>

          {!breakdownCollapsed && breakdownRows.length ? (
            <div className="w-full">
              <div className="grid grid-cols-2 gap-2">
                {breakdownRows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="flex flex-col items-center p-2"
                    style={{
                      background: "var(--win-sunken)",
                      borderTop: "1px solid var(--win-btn-dark-shadow)",
                      borderLeft: "1px solid var(--win-btn-dark-shadow)",
                      borderBottom: "1px solid var(--win-btn-highlight)",
                      borderRight: "1px solid var(--win-btn-highlight)",
                    }}
                  >
                    <span
                      className="mb-1"
                      style={{ fontSize: 10, color: "var(--win-dark)" }}
                    >
                      {row.label}
                    </span>
                    <span
                      className="font-bold"
                      style={{ fontSize: 13, color: "var(--win-navy)" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2 py-1">
          {metrics.map((row, idx) => (
            <div
              key={`${row.label}-${idx}`}
              className="flex flex-col items-center p-2 text-center"
              style={{
                background: "var(--win-sunken)",
                borderTop: "1px solid var(--win-btn-dark-shadow)",
                borderLeft: "1px solid var(--win-btn-dark-shadow)",
                borderBottom: "1px solid var(--win-btn-highlight)",
                borderRight: "1px solid var(--win-btn-highlight)",
              }}
            >
              <div
                className="mb-1"
                style={{ fontSize: 10, color: "var(--win-dark)" }}
              >
                {row.label}
              </div>
              <div
                className="font-bold"
                style={{ fontSize: 15, color: "var(--win-navy)" }}
              >
                {row.value}
              </div>
              {row.subValue ? (
                <div
                  className="mt-1"
                  style={{ fontSize: 10, color: "var(--win-dark)" }}
                >
                  {row.subValue}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {rangeLabel ? (
        <div
          className="mt-2 pt-1"
          style={{
            fontSize: 10,
            color: "var(--win-dark)",
            borderTop: "1px solid var(--win-btn-shadow)",
          }}
        >
          {copy("usage.range_label", { range: rangeLabel })}
          {rangeTimeZoneLabel ? ` ${rangeTimeZoneLabel}` : ""}
        </div>
      ) : null}
    </AsciiBox>
  );
});
