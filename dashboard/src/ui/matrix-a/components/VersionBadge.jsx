import React from "react";
import { copy } from "../../../lib/copy";

export function VersionBadge({ version }) {
  const value = typeof version === "string" ? version.trim() : "";
  if (!value) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      style={{
        background: "var(--win-btn-face)",
        borderTop: "1px solid var(--win-btn-highlight)",
        borderLeft: "1px solid var(--win-btn-highlight)",
        borderBottom: "1px solid var(--win-btn-dark-shadow)",
        borderRight: "1px solid var(--win-btn-dark-shadow)",
        padding: "4px 8px",
        boxShadow: "2px 2px 4px rgba(0,0,0,0.4)",
        fontFamily: '"Tahoma", sans-serif',
        fontSize: 10,
      }}
    >
      <div style={{ color: "var(--win-dark)" }}>
        {copy("dashboard.version.label")}
      </div>
      <div style={{ color: "var(--win-navy, #000080)", fontWeight: "bold", fontSize: 11 }}>{value}</div>
    </div>
  );
}
