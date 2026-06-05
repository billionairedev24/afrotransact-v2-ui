"use client"

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const PRIMARY = "hsl(45 93% 58%)"
const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
}

export type SalesPoint = { day: string; sales: number }
export type OrderStatusSlice = { name: string; value: number; color: string }

export function SalesTrendChart({ data }: { data: SalesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="sellerSalesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.3} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#9ca3af" }}
          itemStyle={{ color: PRIMARY }}
          formatter={(value) => {
            // Recharts' ValueType is `string | number | (string | number)[]`.
            // Sales is always a scalar number — coerce defensively.
            const n = Array.isArray(value) ? Number(value[0]) : Number(value)
            return [`$${Number.isFinite(n) ? n.toLocaleString() : "0"}`, "Sales"] as [string, string]
          }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#sellerSalesGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function OrderStatusPieChart({ data }: { data: OrderStatusSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value, name) => {
            const v = Array.isArray(value) ? value[0] : value
            return [v ?? "0", String(name ?? "")] as [string | number, string]
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
