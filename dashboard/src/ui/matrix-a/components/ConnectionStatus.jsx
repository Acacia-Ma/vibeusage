import React from "react";
import { copy } from "../../../lib/copy";

export function ConnectionStatus({ status = "STABLE", title, className = "" }) {
  const configs = {
    STABLE: {
      color: "var(--win-green)",
      label: copy("dashboard.connection_status.connected"),
    },
    UNSTABLE: {
      color: "var(--win-warning)",
      label: copy("dashboard.connection_status.unstable"),
    },
    LOST: {
      color: "var(--win-danger)",
      label: copy("dashboard.connection_status.disconnected"),
    },
  };

  const current = configs[status] || configs.STABLE;

  return (
    <div
      title={title}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: '"Tahoma", sans-serif',
        fontSize: 11,
        color: "var(--win-text)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: current.color,
          border: "1px solid var(--win-btn-dark-shadow)",
          flexShrink: 0,
        }}
      />
      <span>{current.label}</span>
    </div>
  );
}
