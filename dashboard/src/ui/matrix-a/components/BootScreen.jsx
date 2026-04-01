import { Button } from "@base-ui/react/button";
import React from "react";
import { copy } from "../../../lib/copy";

export function BootScreen({ onSkip }) {
  const canSkip = Boolean(onSkip);

  const className = `min-h-screen flex flex-col items-center justify-center p-8 text-center text-[11px] ${
    canSkip ? "cursor-pointer" : ""
  }`;
  const style = { background: "var(--win-bg)", color: "var(--win-text)", fontFamily: '"Tahoma", "MS Sans Serif", sans-serif' };

  const content = (
    <>
      {/* Win2K style loading dialog */}
      <div
        style={{
          width: 320,
          background: "var(--win-btn-face)",
          border: "2px solid var(--win-btn-highlight)",
          borderRight: "2px solid var(--win-btn-dark-shadow)",
          borderBottom: "2px solid var(--win-btn-dark-shadow)",
          boxShadow: "2px 2px 0 var(--win-darker)",
        }}
      >
        <div className="win-titlebar" style={{ fontSize: 11, padding: "3px 6px" }}>
          <span style={{ flex: 1, fontWeight: "bold" }}>VibeUsage</span>
          <div className="win-titlebar-btn" style={{ fontSize: 8 }}>_</div>
          <div className="win-titlebar-btn" style={{ fontSize: 8 }}>▫</div>
          <div className="win-titlebar-btn" style={{ fontSize: 9, fontWeight: "bold" }}>✕</div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: "bold" }}>
            {copy("boot.prompt")}
          </div>
          {/* Win2K progress bar */}
          <div
            className="win-progress"
            style={{ width: "100%" }}
          >
            <div
              className="win-progress-fill"
              style={{ width: "60%", background: "var(--win-highlight)" }}
            />
          </div>
          {canSkip ? (
            <p style={{ fontSize: 10, color: "var(--win-dark)", margin: 0 }}>{copy("boot.skip_hint")}</p>
          ) : null}
        </div>
      </div>
    </>
  );

  if (!canSkip) {
    return <div className={className} style={style}>{content}</div>;
  }

  return (
    <Button
      className={className}
      style={style}
      onClick={onSkip}
      aria-label={copy("boot.skip_aria")}
      nativeButton={false}
      render={(renderProps) => {
        const { children, ...rest } = renderProps;
        return <div {...rest}>{children}</div>;
      }}
    >
      {content}
    </Button>
  );
}
