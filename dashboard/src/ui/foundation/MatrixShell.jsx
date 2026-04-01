import React from "react";
import { copy } from "../../lib/copy";

export function MatrixShell({
  headerRight,
  headerStatus,
  children,
  footerLeft,
  footerRight,
  contentClassName = "",
  rootClassName = "",
  hideHeader = false,
}) {
  const headerTitle = copy("shell.header.title");

  return (
    <div
      className={`min-h-screen font-matrix text-body leading-tight ${rootClassName}`}
      style={{ background: "var(--win-bg)", color: "var(--win-text)" }}
    >
      {/* Main window chrome */}
      <div className="flex flex-col min-h-screen">
        {/* Window title bar */}
        {!hideHeader ? (
          <>
            <div className="win-titlebar select-none shrink-0">
              {/* App icon */}
              <img
                src="/icon.svg"
                alt=""
                aria-hidden="true"
                className="shrink-0"
                style={{ width: 14, height: 14, imageRendering: "pixelated" }}
              />
              <span className="flex-1 truncate text-xs font-bold text-white" style={{ fontSize: 11 }}>
                {headerTitle} — Usage Monitor
              </span>
              {/* Win2K window control buttons */}
              <div className="flex items-center gap-0.5 ml-2">
                <button
                  type="button"
                  aria-label="Minimize"
                  className="win-titlebar-btn"
                  style={{ fontSize: 8 }}
                >
                  _
                </button>
                <button
                  type="button"
                  aria-label="Maximize"
                  className="win-titlebar-btn"
                  style={{ fontSize: 8 }}
                >
                  ▫
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  className="win-titlebar-btn"
                  style={{ fontSize: 9, fontWeight: "bold" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Menu bar */}
            <div className="win-toolbar shrink-0 text-[11px]">
              <span className="px-2 py-0.5 hover:bg-win-titlebar hover:text-white cursor-default">File</span>
              <span className="px-2 py-0.5 hover:bg-win-titlebar hover:text-white cursor-default">View</span>
              <span className="px-2 py-0.5 hover:bg-win-titlebar hover:text-white cursor-default">Tools</span>
              <span className="px-2 py-0.5 hover:bg-win-titlebar hover:text-white cursor-default">Help</span>
            </div>

            {/* Toolbar with header right content */}
            {headerRight ? (
              <div
                className="shrink-0 flex items-center gap-2 px-3 py-1 text-[11px] overflow-x-auto no-scrollbar"
                style={{
                  background: "var(--win-btn-face)",
                  borderBottom: "1px solid var(--win-btn-shadow)",
                }}
              >
                {/* Status indicator */}
                <div
                  className="flex items-center gap-1 shrink-0 text-[11px] mr-3"
                  style={{ color: "var(--win-text)" }}
                >
                  {headerStatus || (
                    <span className="flex items-center gap-1">
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          background: "var(--win-green)",
                          border: "1px solid var(--win-btn-dark-shadow)",
                        }}
                      />
                      {copy("shell.header.link_active")}
                    </span>
                  )}
                </div>
                <div className="win-toolbar-sep" />
                {headerRight}
              </div>
            ) : (
              <div
                className="shrink-0 px-3 py-1 flex items-center gap-2"
                style={{
                  background: "var(--win-btn-face)",
                  borderBottom: "1px solid var(--win-btn-shadow)",
                }}
              >
                {headerStatus || (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        background: "var(--win-green)",
                        border: "1px solid var(--win-btn-dark-shadow)",
                      }}
                    />
                    {copy("shell.header.link_active")}
                  </span>
                )}
              </div>
            )}
          </>
        ) : null}

        {/* Content area */}
        <main
          className={`flex-1 p-3 overflow-auto ${contentClassName}`}
          style={{ background: "var(--win-bg)" }}
        >
          {children}
        </main>

        {/* Status bar */}
        <footer className="win-statusbar shrink-0 text-[11px]">
          <div className="win-statusbar-panel flex-1">
            {footerLeft || <span>{copy("shell.footer.help")}</span>}
          </div>
          <div className="win-statusbar-panel" style={{ flex: "0 0 auto", minWidth: 160, textAlign: "right" }}>
            {footerRight || <span>{copy("shell.footer.neural_index")}</span>}
          </div>
          {/* Clock panel */}
          <div
            className="win-statusbar-panel text-right shrink-0"
            style={{ minWidth: 72, flex: "0 0 auto" }}
          >
            <WinClock />
          </div>
        </footer>
      </div>
    </div>
  );
}

function WinClock() {
  const [time, setTime] = React.useState(() => formatTime(new Date()));
  React.useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 30000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

function formatTime(d) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}
