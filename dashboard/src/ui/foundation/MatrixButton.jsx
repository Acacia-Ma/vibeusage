import { Button } from "@base-ui/react/button";
import React from "react";

// Win2K classic push button
export function MatrixButton({
  as: Comp = "button",
  children,
  primary = false,
  size = "default",
  className = "",
  ...props
}) {
  const isHeader = size === "header";

  const baseStyle = {
    background: "var(--win-btn-face)",
    color: "var(--win-text)",
    fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
    fontSize: 11,
    borderTop: "2px solid var(--win-btn-highlight)",
    borderLeft: "2px solid var(--win-btn-highlight)",
    borderBottom: "2px solid var(--win-btn-dark-shadow)",
    borderRight: "2px solid var(--win-btn-dark-shadow)",
    boxShadow: "inset -1px -1px 0 var(--win-btn-shadow), inset 1px 1px 0 var(--win-btn-light)",
    padding: isHeader ? "3px 10px" : "2px 8px",
    minWidth: isHeader ? 0 : 75,
    minHeight: isHeader ? 22 : 23,
    cursor: "default",
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    textTransform: "none",
    letterSpacing: 0,
    fontWeight: primary ? "bold" : "normal",
    outline: primary ? "1px solid #000000" : "none",
    outlineOffset: primary ? "1px" : "0",
  };

  const mergedClassName = `win-btn ${primary ? "win-btn--primary" : ""} ${className}`;

  if (Comp === "button") {
    return (
      <Button
        className={mergedClassName}
        style={baseStyle}
        {...props}
      >
        {children}
      </Button>
    );
  }

  const userRole = props.role;

  return (
    <Button
      className={mergedClassName}
      style={baseStyle}
      {...props}
      nativeButton={false}
      render={(renderProps) => {
        const { children: renderChildren, role: resolvedRole, ...rest } = renderProps;
        const role = Comp === "a" && userRole === undefined ? undefined : resolvedRole;
        return (
          <Comp {...rest} role={role} style={baseStyle}>
            {renderChildren}
          </Comp>
        );
      }}
    >
      {children}
    </Button>
  );
}
