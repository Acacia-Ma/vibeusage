import React from "react";

// Win2K GroupBox / Panel — replaces the Matrix ASCII border box
export function AsciiBox({ title, subtitle, children, className = "", bodyClassName = "" }) {
  return (
    <div
      className={`relative flex flex-col ${className}`}
      style={{
        background: "var(--win-btn-face)",
        border: "1px solid var(--win-btn-shadow)",
        boxShadow: "inset -1px -1px 0 var(--win-btn-highlight), inset 1px 1px 0 var(--win-btn-dark-shadow)",
      }}
    >
      {/* Title bar strip — mimics Win2K GroupBox / dialog section header */}
      <div
        className="win-titlebar shrink-0 select-none"
        style={{ fontSize: 11, minHeight: 20, padding: "2px 6px" }}
      >
        <span className="font-bold truncate" style={{ color: "var(--win-titlebar-text)" }}>
          {title}
        </span>
        {subtitle ? (
          <span
            className="ml-2 font-normal text-white/70 truncate"
            style={{ fontSize: 10 }}
          >
            [{subtitle}]
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className={`flex-1 p-3 ${bodyClassName}`} style={{ background: "var(--win-btn-face)" }}>
        {children}
      </div>
    </div>
  );
}

// Keep ASCII_CHARS export for any callers that import it (unused visually now)
export const ASCII_CHARS = {
  TOP_LEFT: "+",
  TOP_RIGHT: "+",
  BOTTOM_LEFT: "+",
  BOTTOM_RIGHT: "+",
  HORIZONTAL: "-",
  VERTICAL: "|",
};
