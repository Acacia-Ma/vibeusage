import React, { useMemo } from "react";
import { copy } from "../../../lib/copy";

function toHandle(auth) {
  const raw = auth?.name?.trim();
  const safe = raw && !raw.includes("@") ? raw : copy("dashboard.identity.fallback");
  return safe.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function IdentityPanel({ auth, streakDays = 0, rankLabel }) {
  const handle = useMemo(() => toHandle(auth), [auth]);
  const rankValue = rankLabel ?? copy("identity_panel.rank_placeholder");
  const streakValue = Number.isFinite(Number(streakDays))
    ? copy("identity_panel.streak_value", { days: Number(streakDays) })
    : copy("identity_panel.rank_placeholder");

  return (
    <div className="flex items-center gap-3">
      {/* Win2K avatar badge */}
      <div
        style={{
          width: 48,
          height: 48,
          background: "var(--win-titlebar)",
          border: "2px solid var(--win-btn-dark-shadow)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: 16,
          fontFamily: '"Tahoma", sans-serif',
          userSelect: "none",
        }}
      >
        {copy("identity_panel.badge")}
      </div>

      <div className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Handle */}
        <div
          style={{
            borderLeft: "3px solid var(--win-titlebar)",
            paddingLeft: 6,
            paddingTop: 2,
            paddingBottom: 2,
            background: "var(--win-sunken)",
            borderTop: "1px solid var(--win-btn-dark-shadow)",
            borderBottom: "1px solid var(--win-btn-highlight)",
            borderRight: "1px solid var(--win-btn-highlight)",
          }}
        >
          <div
            className="font-bold truncate"
            style={{ fontSize: 14, color: "var(--win-text)", textTransform: "uppercase" }}
          >
            {handle}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2" style={{ gap: 2 }}>
          <div
            className="text-center"
            style={{
              padding: "2px 4px",
              background: "var(--win-sunken)",
              borderTop: "1px solid var(--win-btn-dark-shadow)",
              borderLeft: "1px solid var(--win-btn-dark-shadow)",
              borderBottom: "1px solid var(--win-btn-highlight)",
              borderRight: "1px solid var(--win-btn-highlight)",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--win-dark)" }}>
              {copy("identity_panel.rank_label")}
            </div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--win-navy, #000080)" }}>
              {rankValue}
            </div>
          </div>
          <div
            className="text-center"
            style={{
              padding: "2px 4px",
              background: "var(--win-sunken)",
              borderTop: "1px solid var(--win-btn-dark-shadow)",
              borderLeft: "1px solid var(--win-btn-dark-shadow)",
              borderBottom: "1px solid var(--win-btn-highlight)",
              borderRight: "1px solid var(--win-btn-highlight)",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--win-dark)" }}>
              {copy("identity_panel.streak_label")}
            </div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--win-navy, #000080)" }}>
              {streakValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
