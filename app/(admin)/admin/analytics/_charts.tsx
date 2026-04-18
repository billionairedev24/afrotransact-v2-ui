"use client"

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts"

const STATUS_COLORS: Record<string, string> = {
  paid: "#22c55e",
  confirmed: "#3b82f6",
  processing: "#f59e0b",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
  payment_failed: "#f43f5e",
  pending: "#6b7280",
}

const C = {
  axis: "#737373",
  grid: "hsl(var(--border) / 0.45)",
  rev: "#22c55e",
  com: "#3b82f6",
  bar: "#8b5cf6",
  accent: "#f59e0b",
}

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function fmtDay(d: string) {
  if (d.length >= 10) {
    const [, month, day] = d.slice(0, 10).split("-")
    return `${month}/${day}`
  }
  return d.slice(5)
}

function truncateLabel(text: string, max = 22) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

type TooltipPayload = {
  dataKey?: string
  name?: string
  value?: number
  color?: string
  payload?: Record<string, unknown>
}

function formatTooltipValue(item: TooltipPayload): string {
  const v = item.value
  if (v === undefined || v === null) return "—"
  const k = String(item.dataKey ?? item.name ?? "")
  if (k === "revenueCents" || k === "commissionCents") return fmt(Number(v))
  if (k === "commissionRate") return `${v}%`
  if (typeof v === "number") return v.toLocaleString()
  return String(v)
}

function tooltipSeriesLabel(item: TooltipPayload): string {
  const k = String(item.dataKey ?? "")
  if (k === "revenueCents") return "Revenue"
  if (k === "commissionCents") return "Commission"
  if (k === "commissionRate") return "Commission rate"
  if (k === "orderCount") return "Orders"
  if (k === "count") return "Orders"
  return item.name ?? k
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: unknown
  payload?: TooltipPayload[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as
    | { storeFull?: string; regionFull?: string; status?: string; day?: string }
    | undefined
  const title = (() => {
    if (row?.storeFull) return row.storeFull
    if (row?.regionFull) return row.regionFull
    if (row?.status != null) return String(row.status).replace(/_/g, " ")
    if (row?.day) return String(row.day)
    if (label !== undefined && label !== null && String(label).trim() !== "") return String(label)
    return ""
  })()
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-lg">
      {title && <p className="mb-1.5 font-medium text-popover-foreground">{title}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-6 text-muted-foreground">
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              {tooltipSeriesLabel(p)}
            </span>
            <span className="tabular-nums text-popover-foreground">
              {formatTooltipValue(p)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type AdminRevenuePoint = {
  day: string
  revenueCents: number
  commissionCents: number
  orderCount: number
}

export type DailyWithRatePoint = AdminRevenuePoint & { commissionRate: number }

export type StatusRow = { status: string; count: number }
export type TopStoreRow = { storeId: string; revenueCents: number; storeLabel: string; storeFull: string }
export type RegionRow = { regionId?: string; revenueCents: number; regionLabel: string; regionFull: string }

export function RevenueCommissionChart({
  data,
  narrow,
  height,
}: {
  data: AdminRevenuePoint[]
  narrow: boolean
  height: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: narrow ? 4 : 12, left: narrow ? -4 : 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.rev} stopOpacity={0.35} />
              <stop offset="95%" stopColor={C.rev} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.com} stopOpacity={0.35} />
              <stop offset="95%" stopColor={C.com} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={fmtDay}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            interval={narrow ? "preserveStartEnd" : 0}
            minTickGap={narrow ? 28 : 16}
          />
          <YAxis
            tickFormatter={(v) => `$${(Number(v) / 100).toFixed(0)}`}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={narrow ? 44 : 56}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            formatter={(v) => (v === "revenueCents" ? "Revenue" : "Commission")}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Area
            type="monotone"
            dataKey="revenueCents"
            name="revenueCents"
            stroke={C.rev}
            fill="url(#gRev)"
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="commissionCents"
            name="commissionCents"
            stroke={C.com}
            fill="url(#gCom)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DailyOrdersChart({
  data,
  narrow,
  height,
}: {
  data: AdminRevenuePoint[]
  narrow: boolean
  height: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: narrow ? 4 : 12, left: narrow ? -8 : 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={fmtDay}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={narrow ? 28 : 16}
          />
          <YAxis
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="orderCount"
            fill={C.bar}
            radius={[6, 6, 0, 0]}
            maxBarSize={narrow ? 28 : 40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RevenueVsRateChart({
  data,
  narrow,
  height,
}: {
  data: DailyWithRatePoint[]
  narrow: boolean
  height: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: narrow ? 36 : 48, left: narrow ? -8 : 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={fmtDay}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={narrow ? 28 : 16}
          />
          <YAxis
            yAxisId="rev"
            tickFormatter={(v) => `$${(Number(v) / 100).toFixed(0)}`}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={narrow ? 44 : 56}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 40}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            formatter={(v) => (v === "commissionRate" ? "Commission %" : "Revenue")}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar
            yAxisId="rev"
            dataKey="revenueCents"
            fill={C.rev}
            fillOpacity={0.45}
            radius={[6, 6, 0, 0]}
            maxBarSize={narrow ? 28 : 40}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="commissionRate"
            name="commissionRate"
            stroke={C.accent}
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OrdersByStatusChart({
  data,
  narrow,
  height,
}: {
  data: StatusRow[]
  narrow: boolean
  height: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: narrow ? 16 : 24, left: narrow ? 4 : 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="status"
            tickFormatter={(v) =>
              truncateLabel(String(v).replace(/_/g, " "), narrow ? 14 : 18)
            }
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={narrow ? 88 : 104}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="count"
            radius={[0, 6, 6, 0]}
            maxBarSize={narrow ? 22 : 28}
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopStoresChart({
  data,
  narrow,
  height,
  yAxisWidth,
}: {
  data: TopStoreRow[]
  narrow: boolean
  height: number
  yAxisWidth: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: narrow ? 8 : 16, left: narrow ? 4 : 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `$${(Number(v) / 100).toFixed(0)}`}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="storeLabel"
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={yAxisWidth}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="revenueCents"
            fill={C.rev}
            radius={[0, 6, 6, 0]}
            maxBarSize={narrow ? 22 : 28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RevenueByRegionChart({
  data,
  narrow,
  height,
  yAxisWidth,
}: {
  data: RegionRow[]
  narrow: boolean
  height: number
  yAxisWidth: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: narrow ? 8 : 16, left: narrow ? 4 : 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `$${(Number(v) / 100).toFixed(0)}`}
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="regionLabel"
            tick={{ fontSize: narrow ? 10 : 11, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            width={yAxisWidth}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="revenueCents"
            fill={C.com}
            radius={[0, 6, 6, 0]}
            maxBarSize={narrow ? 22 : 28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
