"use client"

import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { SellerAnalyticsProductRevenue } from "@/lib/api"

const FULFILLMENT_COLORS: Record<string, string> = {
  pending: "#6b7280",
  processing: "#f59e0b",
  packaged: "#3b82f6",
  dispatched: "#8b5cf6",
  out_for_delivery: "#06b6d4",
  delivered: "#22c55e",
  delivery_exception: "#ef4444",
  returned: "#f97316",
  shipped: "#10b981",
}

const PRODUCT_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4"]

const TOOLTIP_PROPS = {
  contentStyle: {
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 8,
  },
  labelStyle: { color: "#f9fafb" },
  itemStyle: { color: "#d1d5db" },
}

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function fmtDay(d: string) {
  return d.slice(5)
}

export type SellerRevenuePoint = {
  day: string
  revenueCents: number
  orderCount: number
}

export type FulfillmentRow = { status: string; count: number }

export type SellerProductChartRow = SellerAnalyticsProductRevenue & {
  yAxisLabel: string
  tooltipLabel: string
}

export function RevenueOverTimeChart({ data }: { data: SellerRevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gSelRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDay}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(value) => [fmt(value as number), "Revenue"]}
          labelFormatter={(l) => `Date: ${l}`}
          {...TOOLTIP_PROPS}
        />
        <Area
          type="monotone"
          dataKey="revenueCents"
          stroke="#22c55e"
          fill="url(#gSelRev)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function OrderVolumeChart({ data }: { data: SellerRevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDay}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(value) => [(value as number).toLocaleString(), "Orders"]}
          labelFormatter={(l) => `Date: ${l}`}
          {...TOOLTIP_PROPS}
        />
        <Bar dataKey="orderCount" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function FulfillmentStatusChart({ data }: { data: FulfillmentRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 56, left: 8, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="status"
          tickFormatter={(v) => v.replace(/_/g, " ")}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          formatter={(v) => [(v as number).toLocaleString(), "Items"]}
          {...TOOLTIP_PROPS}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.status}
              fill={FULFILLMENT_COLORS[entry.status] ?? "#6b7280"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TopProductsChart({ rows }: { rows: SellerProductChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 42)}>
      <BarChart
        layout="vertical"
        data={rows}
        margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
      >
        <XAxis
          type="number"
          tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="yAxisLabel"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={132}
        />
        <Tooltip
          formatter={(v) => [fmt(v as number), "Revenue"]}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as SellerProductChartRow | undefined
            return row?.tooltipLabel ?? ""
          }}
          {...TOOLTIP_PROPS}
        />
        <Bar dataKey="revenueCents" radius={[0, 4, 4, 0]}>
          {rows.map((row, i) => (
            <Cell
              key={row.productId}
              fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
