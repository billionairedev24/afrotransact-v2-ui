/**
 * Token-driven recharts theming so charts follow the light/dark theme instead
 * of hardcoded hexes + fixed-dark tooltips. Inline `hsl(var(--…))` values are
 * resolved by the browser at render time, so they adapt automatically.
 *
 * Usage:
 *   <Tooltip {...chartTooltip} />
 *   <CartesianGrid {...chartGrid} />
 *   <XAxis {...chartAxis} />  <YAxis {...chartAxis} />
 *   <Cell fill={CHART_SERIES[i % CHART_SERIES.length]} />
 */
export const CHART_SERIES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export const CHART_GOLD = "hsl(var(--brand-gold))"
export const CHART_GREEN = "hsl(var(--brand-green))"

export const chartAxis = {
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
  stroke: "hsl(var(--border))",
} as const

export const chartGrid = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
  vertical: false,
} as const

export const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 10,
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 600 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted))" },
} as const
