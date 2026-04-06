"use client"

import { useState } from "react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { TrendingUp, DollarSign, ShoppingCart, Percent, Tag, Loader2, AlertTriangle } from "lucide-react"
import { useAdminAnalytics } from "@/hooks/use-admin-stats"
import { AdminShell } from "@/components/admin/AdminShell"

const DAY_OPTIONS = [7, 14, 30, 90, 180, 365]

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

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof DollarSign
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`rounded-full p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30)
  const { data, isLoading, isError } = useAdminAnalytics(days)

  return (
    <AdminShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
            <p className="text-sm text-muted-foreground">Revenue, commission, and order trends</p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-36 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </div>

        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Unable to load analytics. Please try again.
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Total Revenue"
                value={formatCents(data.totalRevenueCents)}
                sub={`${data.totalOrders.toLocaleString()} orders`}
                icon={DollarSign}
                color="bg-emerald-500/10 text-emerald-500"
              />
              <StatCard
                label="Commission Earned"
                value={formatCents(data.totalCommissionCents)}
                sub={
                  data.totalRevenueCents > 0
                    ? `${((data.totalCommissionCents / data.totalRevenueCents) * 100).toFixed(1)}% rate`
                    : undefined
                }
                icon={Percent}
                color="bg-blue-500/10 text-blue-500"
              />
              <StatCard
                label="Total Orders"
                value={data.totalOrders.toLocaleString()}
                icon={ShoppingCart}
                color="bg-violet-500/10 text-violet-500"
              />
              <StatCard
                label="Avg Order Value"
                value={formatCents(data.avgOrderValueCents)}
                icon={TrendingUp}
                color="bg-amber-500/10 text-amber-500"
              />
              <StatCard
                label="Total Discounts"
                value={formatCents(data.totalDiscountCents)}
                icon={Tag}
                color="bg-rose-500/10 text-rose-500"
              />
            </div>

            {/* Revenue + Commission trend */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Revenue & Commission Trend</h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.revenueByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCommission" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => d.slice(5)}
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
                    formatter={(value: number, name: string) => [
                      formatCents(value),
                      name === "revenueCents" ? "Revenue" : "Commission",
                    ]}
                    labelFormatter={(l) => `Date: ${l}`}
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#f9fafb" }}
                    itemStyle={{ color: "#d1d5db" }}
                  />
                  <Legend
                    formatter={(v) => (v === "revenueCents" ? "Revenue" : "Commission")}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenueCents" stroke="#22c55e" fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="commissionCents" stroke="#3b82f6" fill="url(#gradCommission)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders by day bar + Status breakdown */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {/* Daily order count */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Daily Order Count</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.revenueByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(d) => d.slice(5)}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number) => [value, "Orders"]}
                      labelFormatter={(l) => `Date: ${l}`}
                      contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#f9fafb" }}
                      itemStyle={{ color: "#d1d5db" }}
                    />
                    <Bar dataKey="orderCount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Order status breakdown */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Orders by Status</h2>
                {data.ordersByStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie
                          data={data.ordersByStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          strokeWidth={0}
                        >
                          {data.ordersByStatus.map((entry) => (
                            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                          itemStyle={{ color: "#d1d5db" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="flex-1 space-y-2 text-sm">
                      {data.ordersByStatus.map((s) => (
                        <li key={s.status} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: STATUS_COLORS[s.status] ?? "#6b7280" }}
                            />
                            <span className="capitalize text-foreground">{s.status.replace("_", " ")}</span>
                          </span>
                          <span className="text-muted-foreground">{s.count.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Top stores + Revenue by region */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {/* Top stores */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Top Stores by Revenue</h2>
                {data.topStores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.topStores.map((store, i) => {
                      const max = data.topStores[0].revenueCents
                      const pct = max > 0 ? (store.revenueCents / max) * 100 : 0
                      return (
                        <div key={store.storeId} className="flex items-center gap-3">
                          <span className="w-4 text-right text-xs text-muted-foreground">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="truncate text-foreground font-mono">{store.storeId.slice(0, 8)}…</span>
                              <span className="shrink-0 text-muted-foreground ml-2">{formatCents(store.revenueCents)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Revenue by region */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Revenue by Region</h2>
                {data.revenueByRegion.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.revenueByRegion.map((region, i) => {
                      const max = data.revenueByRegion[0].revenueCents
                      const pct = max > 0 ? (region.revenueCents / max) * 100 : 0
                      return (
                        <div key={region.regionId} className="flex items-center gap-3">
                          <span className="w-4 text-right text-xs text-muted-foreground">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="truncate text-foreground font-mono">{region.regionId}</span>
                              <span className="shrink-0 text-muted-foreground ml-2">{formatCents(region.revenueCents)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
