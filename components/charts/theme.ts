/**
 * Recharts renders into SVG outside the Tailwind class tree, so its colors have
 * to be handed over explicitly. Pointing them at the theme variables keeps the
 * grid, tooltips and axes correct in both light and dark mode.
 */
export const CHART_GRID = "var(--color-border)";

export const CHART_AXIS_TICK = {
  fontSize: 10,
  fill: "var(--color-muted-foreground)",
} as const;

export const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  fontFamily: "var(--font-vazirmatn)",
  direction: "rtl",
} as const;

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: "var(--color-foreground)",
} as const;

/** Series colors, mirroring the semantic tokens used across the panels. */
export const SERIES = {
  received: "oklch(0.65 0.18 155)",
  sent: "oklch(0.55 0.20 275)",
} as const;
