import React, { useEffect, useMemo, useState } from "react";
import { isScreenshotModeEnabled } from "../../../lib/screenshot-mode.js";

export function ConnectionStatus({ status = "STABLE", title, className = "" }) {
  const [bit, setBit] = useState("0");
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);

  useEffect(() => {
    let interval;
    if (status === "STABLE") {
      if (screenshotMode) {
        setBit("1");
        return undefined;
      }
      interval = window.setInterval(() => {
        setBit(Math.random() > 0.5 ? "1" : "0");
      }, 150);
    }
    return () => window.clearInterval(interval);
  }, [screenshotMode, status]);

  const configs = {
    STABLE: {
      color: "var(--win-green)",
      label: "Connected",
    },
    UNSTABLE: {
      color: "#b87800",
      label: "Unstable",
    },
    LOST: {
      color: "#cc0000",
      label: "Disconnected",
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
