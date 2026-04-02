import React from "react";
import { copy } from "../../../lib/copy";
import { formatCompactNumber } from "../../../lib/format";
import { TEXTURES } from "./MatrixConstants";

export const NeuralAdaptiveFleet = React.memo(function NeuralAdaptiveFleet({
  label,
  totalPercent,
  usage = 0,
  models = [],
}) {
  const percentSymbol = copy("shared.unit.percent");
  const thousandSuffix = copy("shared.unit.thousand_abbrev");
  const millionSuffix = copy("shared.unit.million_abbrev");
  const billionSuffix = copy("shared.unit.billion_abbrev");
  const usageValue = formatCompactNumber(usage, {
    thousandSuffix,
    millionSuffix,
    billionSuffix,
    decimals: 1,
  });
  const usageLabel = copy("dashboard.model_breakdown.usage_label", {
    value: usageValue,
  });

  return (
    <div className="w-full" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        className="flex justify-between items-baseline pb-1"
        style={{
          borderBottom: "1px solid var(--win-btn-shadow)",
          paddingBottom: 4,
          marginBottom: 4,
        }}
      >
        <div className="flex items-baseline gap-2">
          <span style={{ fontWeight: "bold", fontSize: 11, color: "var(--win-text)" }}>{label}</span>
          <span style={{ fontSize: 10, color: "var(--win-dark)" }}>{usageLabel}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span style={{ fontWeight: "bold", fontSize: 13, color: "var(--win-navy)" }}>{totalPercent}</span>
          <span style={{ fontSize: 10, color: "var(--win-dark)" }}>{percentSymbol}</span>
        </div>
      </div>

      {/* Win2K progress bar style */}
      <div
        style={{
          height: 14,
          width: "100%",
          display: "flex",
          overflow: "hidden",
          borderTop: "1px solid var(--win-btn-dark-shadow)",
          borderLeft: "1px solid var(--win-btn-dark-shadow)",
          borderBottom: "1px solid var(--win-btn-highlight)",
          borderRight: "1px solid var(--win-btn-highlight)",
          background: "var(--win-sunken-bg)",
        }}
      >
        {models.map((model, index) => {
          const styleConfig = TEXTURES[index % TEXTURES.length];
          const modelKey = model?.id ? String(model.id) : `${model.name}-${index}`;
          return (
            <div
              key={modelKey}
              style={{
                width: `${model.share}%`,
                height: "100%",
                backgroundColor: styleConfig.bg,
                backgroundImage: styleConfig.pattern,
                backgroundSize: styleConfig.size || "auto",
                borderRight:
                  index < models.length - 1 ? "1px solid var(--win-btn-highlight)" : "none",
                transition: "width 0.5s ease-out",
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2" style={{ gap: "4px 16px" }}>
        {models.map((model, index) => {
          const styleConfig = TEXTURES[index % TEXTURES.length];
          const modelKey = model?.id ? String(model.id) : `${model.name}-${index}`;
          return (
            <div key={modelKey} className="flex items-center" style={{ gap: 4 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                  backgroundColor: styleConfig.bg,
                  backgroundImage: styleConfig.pattern,
                  backgroundSize: styleConfig.size || "auto",
                  border: "1px solid var(--win-btn-dark-shadow)",
                }}
              />
              <div className="flex items-baseline min-w-0" style={{ gap: 4 }}>
                <span
                  style={{ fontSize: 10, color: "var(--win-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "bold" }}
                  title={model.name}
                >
                  {model.name}
                </span>
                <span style={{ fontSize: 10, color: "var(--win-dark)", whiteSpace: "nowrap" }}>
                  {model.share}
                  {percentSymbol}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
