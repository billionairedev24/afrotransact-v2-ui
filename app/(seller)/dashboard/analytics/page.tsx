"use client"

import { useState, useEffect } from "react"
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
import { TrendingUp, DollarSign, ShoppingCart, Package, Loader2, AlertTriangle } from "lucide-react"
import { useSellerMe, useSellerStores, useSellerAnalytics } from "@/hooks/use-seller-stats"
import { SellerShell } from "@/components/seller/SellerShell"
import { useSession } from "next-auth/react"

const DAY_OPTIONS = [7, 14, 30, 90, 180, 365]

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

export default function SellerAnalyticsPage() {
  const { data: session } = useSession()
  const [days, setDays] = useState(30)

  const { data: seller } = useSellerMe()
  const { data: stores } = useSellerStores(seller?.id)
  const storeIds = (stores ?? []).map((s) => s.id)

  const { data, isLoading, isError } = useSellerAnalytics(storeIds, days)

  return (
    <SellerShell
      userName={session?.user?.name ?? undefined}
      userEmail={session?.user?.email ?? undefined}
      seller={seller}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Store Analytics</h1>
            <p className="text-sm text-muted-foreground">Revenue and fulfillment insights for your stores</p>
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

        {(isLoading || storeIds.length === 0) && !isError && (
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Revenue"
                value={formatCents(data.totalRevenueCents)}
                sub={`${data.totalOrders.toLocaleString()} orders`}
                icon={DollarSign}
                color="bg-emerald-500/10 text-emerald-500"
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
                label="Fulfillment Rate"
                value={`${data.fulfillmentRate}%`}
                sub="Shipped + delivered"
                icon={Package}
                color="bg-blue-500/10 text-blue-500"
              />
            </div>

            {/* Revenue trend */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.revenueByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSellerRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
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
                    formatter={(value: number) => [formatCents(value), "Revenue"]}
                    labelFormatter={(l) => `Date: ${l}`}
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#f9fafb" }}
                    itemStyle={{ color: "#d1d5db" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenueCents"
                    stroke="#22c55e"
                    fill="url(#gradSellerRevenue)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders by day + Fulfillment breakdown */}
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

              {/* Fulfillment status pie */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Fulfillment by Status</h2>
                {data.fulfillmentByStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie
                          data={data.fulfillmentByStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          strokeWidth={0}
                        >
                          {data.fulfillmentByStatus.map((entry) => (
                            <Cell key={entry.status} fill={FULFILLMENT_COLORS[entry.status] ?? "#6b7280"} />
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
                      {data.fulfillmentByStatus.map((s) => (
                        <li key={s.status} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: FULFILLMENT_COLORS[s.status] ?? "#6b7280" }}
                            />
                            <span className="capitalize text-foreground">{s.status.replace(/_/g, " ")}</span>
                          </span>
                          <span className="text-muted-foreground">{s.count.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Top products */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Top Products by Revenue</h2>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">#</th>
                        <th className="pb-2 pr-4 font-medium">Product</th>
                        <th className="pb-2 pr-4 font-medium text-right">Revenue</th>
                        <th className="pb-2 pr-4 font-medium text-right">Units</th>
                        <th className="pb-2 font-medium text-right">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((product, i) => (
                        <tr key={product.productId} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 pr-4">
                            <p className="font-medium text-foreground line-clamp-1">{product.productTitle || "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{product.productId.slice(0, 8)}…</p>
                          </td>
                          <td className="py-2.5 pr-4 text-right text-foreground">{formatCents(product.revenueCents)}</td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground">{product.unitsSold.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{product.orderCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SellerShell>
  )
}
