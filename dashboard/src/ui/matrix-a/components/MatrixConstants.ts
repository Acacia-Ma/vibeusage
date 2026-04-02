export const COLORS = {
  PRIMARY_FILL: "rgb(var(--win-accent-rgb) / 0.6)",
  PRIMARY_PATTERN_STRONG: "rgb(var(--win-accent-rgb) / 0.2)",
  PRIMARY_PATTERN_SOFT: "rgb(var(--win-accent-rgb) / 0.1)",
};

export const TEXTURES = [
  // Solid fill with reduced opacity so the first segment does not dominate.
  { bg: COLORS.PRIMARY_FILL, pattern: "none" },
  // Diagonal stripes with a light tint.
  {
    bg: "transparent",
    pattern: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${COLORS.PRIMARY_PATTERN_STRONG} 2px, ${COLORS.PRIMARY_PATTERN_STRONG} 4px)`,
  },
  // Sparse dotted pattern for secondary differentiation.
  {
    bg: "transparent",
    pattern: `radial-gradient(${COLORS.PRIMARY_PATTERN_STRONG} 1px, transparent 1px)`,
    size: "4px 4px",
  },
  // Thin vertical separators as a subtle fourth texture.
  {
    bg: "transparent",
    pattern: `linear-gradient(90deg, ${COLORS.PRIMARY_PATTERN_SOFT} 1px, transparent 1px)`,
    size: "3px 100%",
  },
];
