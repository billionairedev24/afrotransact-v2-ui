"use client"

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Loader2,
  AlertTriangle,
  FileDown,
  FileJson,
  Lock,
} from "lucide-react"
import { useSellerMe, useSellerStores, useSellerAnalytics } from "@/hooks/use-seller-stats"
import { useAnalyticsAvailability } from "@/hooks/use-analytics-settings"
import { localYmdToday, localYmdDaysAgo } from "@/lib/local-date"
import type { SellerAnalyticsProductRevenue } from "@/lib/api"

// Recharts is ~100KB parsed. Defer to its own chunk so the page shell
// (KPIs + date picker + export buttons) can paint before charts hydrate.
const ChartSkeleton = () => (
  <div className="h-full min-h-[220px] w-full animate-pulse rounded-lg bg-muted/40" />
)
const RevenueOverTimeChart = dynamic(
  () => import("./_charts").then((m) => m.RevenueOverTimeChart),
  { ssr: false, loading: ChartSkeleton }
)
const OrderVolumeChart = dynamic(
  () => import("./_charts").then((m) => m.OrderVolumeChart),
  { ssr: false, loading: ChartSkeleton }
)
const FulfillmentStatusChart = dynamic(
  () => import("./_charts").then((m) => m.FulfillmentStatusChart),
  { ssr: false, loading: ChartSkeleton }
)
const TopProductsChart = dynamic(
  () => import("./_charts").then((m) => m.TopProductsChart),
  { ssr: false, loading: ChartSkeleton }
)

// ── Date helpers ───────────────────────────────────────────────────────────────

function todayStr() {
  return localYmdToday()
}

function offsetDateStr(days: number) {
  return localYmdDaysAgo(days)
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map((n) => Number(n))
  return new Date(y, (m || 1) - 1, d || 1)
}


// Sellers are capped at 90-day lookback both in the UI and in exports
const SELLER_MAX_DAYS = 90

const SELLER_PRESETS = [
  { label: "7D",  days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
]

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/** Same idea as admin store labels: prefer API title, else a short id-based label. */
function fullProductLabel(p: SellerAnalyticsProductRevenue) {
  const n = p.productTitle?.trim()
  if (n) return n
  return `Product ${p.productId.slice(0, 8)}…`
}

function truncateLabel(text: string, max = 22) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

type SellerProductChartRow = SellerAnalyticsProductRevenue & {
  yAxisLabel: string
  tooltipLabel: string
}

function blobDownload(content: string, mimeType: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const a = Object.assign(document.createElement("a"), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  )
}

export default function SellerAnalyticsPage() {
  const { data: availability, isLoading: flagLoading } = useAnalyticsAvailability()
  const analyticsEnabled = availability?.sellerAnalyticsEnabled !== false

  const [startDate, setStartDate] = useState(() => offsetDateStr(30))
  const [endDate,   setEndDate]   = useState(() => todayStr())

  const { data: seller } = useSellerMe()
  const { data: stores } = useSellerStores(seller?.id)
  const storeIds = (stores ?? []).map((s) => s.id)

  const rangeError = useMemo(() => {
    if (!startDate || !endDate) return "Start and end dates are required."
    if (parseYmd(startDate).getTime() > parseYmd(endDate).getTime()) {
      return "Start date cannot be after end date."
    }
    const diffDays = Math.floor((parseYmd(endDate).getTime() - parseYmd(startDate).getTime()) / 86_400_000)
    if (diffDays > SELLER_MAX_DAYS) return `Date range cannot exceed ${SELLER_MAX_DAYS} days.`
    return null
  }, [startDate, endDate])

  const { data, isLoading, isError } = useSellerAnalytics(storeIds, startDate, endDate, !rangeError)

  const kpi = useMemo(() => {
    const rb = data?.revenueByDay ?? []
    const sumRevenue = rb.reduce((acc, d) => acc + (d.revenueCents ?? 0), 0)
    const sumOrders = rb.reduce((acc, d) => acc + (d.orderCount ?? 0), 0)

    const totalRevenueCents =
      (data?.totalRevenueCents ?? 0) > 0 ? (data?.totalRevenueCents ?? 0) : sumRevenue
    const totalOrders = (data?.totalOrders ?? 0) > 0 ? (data?.totalOrders ?? 0) : sumOrders

    const avgOrderValueCents =
      (data?.avgOrderValueCents ?? 0) > 0
        ? (data?.avgOrderValueCents ?? 0)
        : totalOrders > 0
          ? Math.round(totalRevenueCents / totalOrders)
          : 0

    const fulfillmentRate =
      (data?.fulfillmentRate ?? 0) > 0
        ? (data?.fulfillmentRate ?? 0)
        : (() => {
            const rows = data?.fulfillmentByStatus ?? []
            const total = rows.reduce((acc, r) => acc + (r.count ?? 0), 0)
            const fulfilled = rows
              .filter((r) => r.status === "shipped" || r.status === "delivered")
              .reduce((acc, r) => acc + (r.count ?? 0), 0)
            return total > 0 ? Math.round((fulfilled * 100) / total) : 0
          })()

    return { totalRevenueCents, totalOrders, avgOrderValueCents, fulfillmentRate }
  }, [data])

  const top5ChartRows = useMemo((): SellerProductChartRow[] => {
    return (data?.topProducts ?? []).slice(0, 5).map((p) => {
      const full = fullProductLabel(p)
      return { ...p, yAxisLabel: truncateLabel(full), tooltipLabel: full }
    })
  }, [data?.topProducts])

  const activePreset = useCallback((): string | null => {
    const t = todayStr()
    return SELLER_PRESETS.find(p => endDate === t && startDate === offsetDateStr(p.days))?.label ?? null
  }, [startDate, endDate])

  function applyPreset(days: number) {
    setStartDate(offsetDateStr(days))
    setEndDate(todayStr())
  }

  // ── Export handlers ────────────────────────────────────────────────────────

  function handleCSV() {
    if (!data) return
    const rows = [
      `# Store Analytics: ${startDate} to ${endDate}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Note: Limited to your store data only`,
      "",
      "## Daily Revenue",
      "Date,Revenue (USD),Orders",
      ...data.revenueByDay.map((d) =>
        [d.day, (d.revenueCents / 100).toFixed(2), d.orderCount].join(",")
      ),
      "",
      "## Fulfillment by Status",
      "Status,Count",
      ...data.fulfillmentByStatus.map((s) => [s.status, s.count].join(",")),
      "",
      "## Top Products (max 10)",
      "Product Title,Product ID,Revenue (USD),Units Sold,Orders",
      ...data.topProducts.slice(0, 10).map((p) =>
        [
          `"${fullProductLabel(p).replace(/"/g, '""')}"`,
          p.productId,
          (p.revenueCents / 100).toFixed(2),
          p.unitsSold,
          p.orderCount,
        ].join(",")
      ),
    ].join("\n")
    blobDownload(rows, "text/csv;charset=utf-8;", `store-analytics-${startDate}_${endDate}.csv`)
  }

  function handleJSON() {
    if (!data) return
    // Sellers receive a summary object only — no raw day-by-day granularity
    const summary = {
      note: "Store-level summary only. Raw time-series data not included in seller exports.",
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenueCents: data.totalRevenueCents,
        totalOrders: data.totalOrders,
        avgOrderValueCents: data.avgOrderValueCents,
        fulfillmentRate: data.fulfillmentRate,
      },
      fulfillmentByStatus: data.fulfillmentByStatus,
      topProducts: data.topProducts.slice(0, 10).map((p) => ({
        productTitle: fullProductLabel(p),
        productId: p.productId,
        revenueCents: p.revenueCents,
        unitsSold: p.unitsSold,
        orderCount: p.orderCount,
      })),
    }
    blobDownload(JSON.stringify(summary, null, 2), "application/json", `store-analytics-${startDate}_${endDate}.json`)
  }

  // ── Fulfillment rate color coding ──────────────────────────────────────────

  const fulfillmentColor =
    (kpi.fulfillmentRate ?? 0) >= 80
      ? "bg-emerald-500/10 text-emerald-500"
      : (kpi.fulfillmentRate ?? 0) >= 50
        ? "bg-amber-500/10 text-amber-500"
        : "bg-red-500/10 text-red-500"

  // ── Render ─────────────────────────────────────────────────────────────────

  if (flagLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!analyticsEnabled) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Analytics is not available</p>
        <p className="text-sm text-muted-foreground">
          Seller analytics is turned off for the platform. Ask an admin to enable it under{" "}
          <span className="text-foreground">Feature Flags → Analytics access</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Store Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Revenue and fulfillment insights for your stores
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCSV}
              disabled={!data}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="h-3.5 w-3.5" />
              CSV (Excel)
            </button>
            <button
              onClick={handleJSON}
              disabled={!data}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileJson className="h-3.5 w-3.5" />
              Summary JSON
            </button>
          </div>
        </div>

        {/* Date range picker — max 90 days for sellers */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {SELLER_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className={[
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  activePreset() === p.label
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground/30",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span className="hidden text-xs text-muted-foreground sm:block">or</span>

          {/* Custom date inputs */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayStr()}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {activePreset() === null && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                Custom
              </span>
            )}
          </div>

          {/* 90-day cap notice */}
          <p className="text-xs text-amber-500/90 sm:ml-auto">Max 90-day range</p>
        </div>
        {rangeError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {rangeError}
          </div>
        )}
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
          {/* ── KPI cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={fmt(kpi.totalRevenueCents)}
              sub={`${kpi.totalOrders.toLocaleString()} orders`}
              icon={DollarSign}
              color="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard
              label="Total Orders"
              value={kpi.totalOrders.toLocaleString()}
              icon={ShoppingCart}
              color="bg-violet-500/10 text-violet-500"
            />
            <StatCard
              label="Avg Order Value"
              value={fmt(kpi.avgOrderValueCents)}
              icon={TrendingUp}
              color="bg-amber-500/10 text-amber-500"
            />
            <StatCard
              label="Fulfillment Rate"
              value={`${kpi.fulfillmentRate}%`}
              sub="Shipped + delivered"
              icon={Package}
              color={fulfillmentColor}
            />
          </div>

          {/* ── Revenue over time ──────────────────────────────────────────── */}
          <ChartCard title="Revenue over time">
            <RevenueOverTimeChart data={data.revenueByDay} />
          </ChartCard>

          {/* ── Order volume over time ─────────────────────────────────────── */}
          <ChartCard title="Order volume over time">
            <OrderVolumeChart data={data.revenueByDay} />
          </ChartCard>

          {/* ── Fulfillment status + Top 5 products ───────────────────────── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Fulfillment by Status">
              {data.fulfillmentByStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fulfillment data yet</p>
              ) : (
                <FulfillmentStatusChart data={data.fulfillmentByStatus} />
              )}
            </ChartCard>

            <ChartCard title="Top 5 Products by Revenue">
              {top5ChartRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No product data yet</p>
              ) : (
                <TopProductsChart rows={top5ChartRows} />
              )}
            </ChartCard>
          </div>

          {/* ── Top products table ────────────────────────────────────────── */}
          {data.topProducts.length > 0 && (
            <ChartCard title="Product Performance Breakdown">
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
                      <tr
                        key={product.productId}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                        <td className="py-2.5 pr-4">
                          <p
                            className="font-medium text-foreground line-clamp-1"
                            title={fullProductLabel(product)}
                          >
                            {fullProductLabel(product)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {product.productId.slice(0, 8)}…
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-foreground">
                          {fmt(product.revenueCents)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">
                          {product.unitsSold.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {product.orderCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Export buttons moved to top (header) */}
        </>
      )}
    </div>
  )
}
