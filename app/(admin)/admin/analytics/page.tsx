"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
  Tag,
  Loader2,
  AlertTriangle,
  FileDown,
  FileJson,
  Printer,
} from "lucide-react"
import { useAdminAnalytics } from "@/hooks/use-admin-stats"
import { useAnalyticsAvailability } from "@/hooks/use-analytics-settings"
import type { AdminAnalyticsStoreRevenue, AdminAnalyticsRegionRevenue } from "@/lib/api"
import { localYmdToday, localYmdDaysAgo } from "@/lib/local-date"

// Recharts (~100KB) is loaded in its own chunk once the page shell,
// platform-health panel, and KPI cards are already visible.
const ChartSkeleton = () => (
  <div className="h-full min-h-[200px] w-full animate-pulse rounded-lg bg-muted/40" />
)
const RevenueCommissionChart = dynamic(
  () => import("./_charts").then((m) => m.RevenueCommissionChart),
  { ssr: false, loading: ChartSkeleton }
)
const DailyOrdersChart = dynamic(
  () => import("./_charts").then((m) => m.DailyOrdersChart),
  { ssr: false, loading: ChartSkeleton }
)
const RevenueVsRateChart = dynamic(
  () => import("./_charts").then((m) => m.RevenueVsRateChart),
  { ssr: false, loading: ChartSkeleton }
)
const OrdersByStatusChart = dynamic(
  () => import("./_charts").then((m) => m.OrdersByStatusChart),
  { ssr: false, loading: ChartSkeleton }
)
const TopStoresChart = dynamic(
  () => import("./_charts").then((m) => m.TopStoresChart),
  { ssr: false, loading: ChartSkeleton }
)
const RevenueByRegionChart = dynamic(
  () => import("./_charts").then((m) => m.RevenueByRegionChart),
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



const ADMIN_PRESETS = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
]
const ADMIN_MAX_DAYS = 365

// ── Display names (backend sends storeName / regionName when DB joins work) ───

function fullStoreLabel(s: AdminAnalyticsStoreRevenue) {
  const n = s.storeName?.trim()
  if (n) return n
  return `Store ${s.storeId.slice(0, 8)}…`
}

function fullRegionLabel(r: AdminAnalyticsRegionRevenue) {
  const n = r.regionName?.trim()
  if (n) return n
  return r.regionId ? `Region ${r.regionId.slice(0, 8)}…` : "Unknown"
}

function truncateLabel(text: string, max = 22) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function useNarrowScreen(breakpoint = 640) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [breakpoint])
  return narrow
}

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`shrink-0 rounded-full p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-3 sm:p-5">{children}</div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const narrow = useNarrowScreen(640)
  const chartH = narrow ? 240 : 300
  const chartHSm = narrow ? 200 : 240
  const yAxisWStore = narrow ? 110 : 148
  const yAxisWRegion = narrow ? 100 : 132

  const { data: availability, isLoading: flagLoading } = useAnalyticsAvailability()
  const analyticsEnabled = availability?.adminAnalyticsEnabled !== false

  const [startDate, setStartDate] = useState(() => offsetDateStr(30))
  const [endDate, setEndDate] = useState(() => todayStr())
  const rangeError = useMemo(() => {
    if (!startDate || !endDate) return "Start and end dates are required."
    if (parseYmd(startDate).getTime() > parseYmd(endDate).getTime()) {
      return "Start date cannot be after end date."
    }
    const diffDays = Math.floor((parseYmd(endDate).getTime() - parseYmd(startDate).getTime()) / 86_400_000)
    if (diffDays > ADMIN_MAX_DAYS) return `Date range cannot exceed ${ADMIN_MAX_DAYS} days.`
    return null
  }, [startDate, endDate])

  const { data, isLoading, isError } = useAdminAnalytics(startDate, endDate, !rangeError)

  const activePreset = useCallback((): string | null => {
    const t = todayStr()
    return ADMIN_PRESETS.find((p) => endDate === t && startDate === offsetDateStr(p.days))?.label ?? null
  }, [startDate, endDate])

  function applyPreset(days: number) {
    setStartDate(offsetDateStr(days))
    setEndDate(todayStr())
  }

  const dailyWithRate = useMemo(
    () =>
      (data?.revenueByDay ?? []).map((d) => ({
        ...d,
        commissionRate:
          d.revenueCents > 0
            ? parseFloat(((d.commissionCents / d.revenueCents) * 100).toFixed(1))
            : 0,
      })),
    [data?.revenueByDay],
  )

  const topStoreRows = useMemo(
    () =>
      (data?.topStores ?? []).map((s) => ({
        ...s,
        storeLabel: truncateLabel(fullStoreLabel(s)),
        storeFull: fullStoreLabel(s),
      })),
    [data?.topStores],
  )

  const regionRows = useMemo(
    () =>
      (data?.revenueByRegion ?? []).map((r) => ({
        ...r,
        regionLabel: truncateLabel(fullRegionLabel(r)),
        regionFull: fullRegionLabel(r),
      })),
    [data?.revenueByRegion],
  )

  const platformHealthWarnings = (data as { platformHealthWarnings?: string[] } | undefined)
    ?.platformHealthWarnings

  // ── Export handlers ────────────────────────────────────────────────────────

  function handleCSV() {
    if (!data) return
    const rows = [
      `# AfroTransact Platform Analytics: ${startDate} to ${endDate}`,
      ["Date", "Revenue (USD)", "Commission (USD)", "Commission Rate (%)", "Orders"].join(","),
      ...data.revenueByDay.map((d) =>
        [
          d.day,
          (d.revenueCents / 100).toFixed(2),
          (d.commissionCents / 100).toFixed(2),
          d.revenueCents > 0 ? ((d.commissionCents / d.revenueCents) * 100).toFixed(1) : "0",
          d.orderCount,
        ].join(","),
      ),
      "",
      ["Status", "Order Count", "Revenue (USD)"].join(","),
      ...data.ordersByStatus.map((s) => [s.status, s.count, (s.revenueCents / 100).toFixed(2)].join(",")),
      "",
      ["Store name", "Store ID", "Revenue (USD)", "Orders"].join(","),
      ...data.topStores.map((s) =>
        [
          `"${fullStoreLabel(s).replace(/"/g, '""')}"`,
          s.storeId,
          (s.revenueCents / 100).toFixed(2),
          s.orderCount,
        ].join(","),
      ),
      "",
      ["Region name", "Region ID", "Revenue (USD)", "Orders"].join(","),
      ...data.revenueByRegion.map((r) =>
        [
          `"${fullRegionLabel(r).replace(/"/g, '""')}"`,
          r.regionId,
          (r.revenueCents / 100).toFixed(2),
          r.orderCount,
        ].join(","),
      ),
    ].join("\n")
    blobDownload(rows, "text/csv;charset=utf-8;", `platform-analytics-${startDate}_${endDate}.csv`)
  }

  function handleJSON() {
    if (!data) return
    blobDownload(
      JSON.stringify({ startDate, endDate, generatedAt: new Date().toISOString(), ...data }, null, 2),
      "application/json",
      `platform-analytics-${startDate}_${endDate}.json`,
    )
  }

  function handlePrint() {
    if (!data) return

    const statCards = [
      { label: "Total Revenue", value: fmt(data.totalRevenueCents) },
      { label: "Commission Earned", value: fmt(data.totalCommissionCents) },
      { label: "Total Orders", value: data.totalOrders.toLocaleString() },
      { label: "Avg Order Value", value: fmt(data.avgOrderValueCents) },
      { label: "Total Discounts", value: fmt(data.totalDiscountCents) },
    ]

    const statsHtml = statCards
      .map(
        (s) =>
          `<div class="stat"><div class="slabel">${s.label}</div><div class="sval">${s.value}</div></div>`,
      )
      .join("")

    const table = (heading: string, headers: string[], rows: (string | number)[][]) => `
      <h3>${heading}</h3>
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`

    const win = window.open("", "_blank", "width=960,height=720")
    if (!win) return

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Platform Analytics Report – ${startDate} to ${endDate}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;margin:0;padding:28px}
        h1{font-size:20px;margin:0 0 2px}
        .sub{color:#6b7280;font-size:11px;margin:0 0 20px}
        .stats{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
        .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;min-width:130px}
        .slabel{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
        .sval{font-size:18px;font-weight:700;margin-top:2px}
        h3{font-size:11px;font-weight:600;color:#374151;margin:20px 0 6px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:4px}
        th{background:#f1f5f9;text-align:left;padding:5px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#374151}
        td{padding:4px 10px;border-bottom:1px solid #f8fafc;font-size:11px}
        .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#9ca3af}
        @media print{@page{margin:1.5cm}}
      </style>
    </head><body>
      <h1>Platform Analytics Report</h1>
      <p class="sub">${startDate} → ${endDate} · Generated ${new Date().toLocaleString()}</p>
      <div class="stats">${statsHtml}</div>
      ${table(
        "Daily Revenue & Commission",
        ["Date", "Revenue", "Commission", "Commission %", "Orders"],
        data.revenueByDay.map((d) => [
          d.day,
          fmt(d.revenueCents),
          fmt(d.commissionCents),
          d.revenueCents > 0 ? `${((d.commissionCents / d.revenueCents) * 100).toFixed(1)}%` : "—",
          d.orderCount,
        ]),
      )}
      ${table(
        "Orders by Status",
        ["Status", "Count", "Revenue"],
        data.ordersByStatus.map((s) => [s.status.replace(/_/g, " "), s.count, fmt(s.revenueCents)]),
      )}
      ${table(
        "Top Stores by Revenue",
        ["#", "Store", "Revenue", "Orders"],
        data.topStores.map((s, i) => [i + 1, fullStoreLabel(s), fmt(s.revenueCents), s.orderCount]),
      )}
      ${table(
        "Revenue by Region",
        ["#", "Region", "Revenue", "Orders"],
        data.revenueByRegion.map((r, i) => [i + 1, fullRegionLabel(r), fmt(r.revenueCents), r.orderCount]),
      )}
      <div class="footer">AfroTransact Platform · Confidential · ${new Date().toLocaleDateString()}</div>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

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
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Analytics is disabled</p>
        <p className="text-sm text-muted-foreground">
          Turn on <strong className="text-foreground">Admin analytics</strong> under{" "}
          <span className="text-foreground">Feature Flags → Analytics access</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Title + exports (primary actions at top) */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Platform Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders, revenue, and cross-service health — export matches the selected date range.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Export report</p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={handleCSV}
              disabled={!data}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 sm:flex-initial sm:min-h-0"
            >
              <FileDown className="h-4 w-4 shrink-0" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleJSON}
              disabled={!data}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 sm:flex-initial sm:min-h-0"
            >
              <FileJson className="h-4 w-4 shrink-0" />
              JSON
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!data}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial sm:min-h-0"
            >
              <Printer className="h-4 w-4 shrink-0" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {ADMIN_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.days)}
              className={[
                "min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                activePreset() === p.label
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-muted-foreground sm:inline">·</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="min-h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayStr()}
            onChange={(e) => setEndDate(e.target.value)}
            className="min-h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {activePreset() === null && (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Custom range
            </span>
          )}
        </div>
        <p className="text-xs text-amber-500/90 sm:ml-auto">Max 365-day range</p>
      </div>
      {rangeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {rangeError}
        </div>
      )}

      {isLoading && (
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Unable to load analytics. Check your connection and try again.</span>
        </div>
      )}

      {data && (
        <>
          {platformHealthWarnings && platformHealthWarnings.length > 0 && (
            <div
              role="status"
              className="rounded-xl border border-amber-600/35 bg-amber-500/[0.08] px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/40"
            >
              <p className="text-sm font-medium text-foreground">
                Some platform health metrics could not be loaded
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Unavailable:{" "}
                <span className="font-medium text-foreground">{platformHealthWarnings.join(", ")}</span>.
                Order analytics below are still shown. Ensure those services are running and reachable through
                the API gateway.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
            <StatCard
              label="Total Revenue"
              value={fmt(data.totalRevenueCents)}
              sub={`${data.totalOrders.toLocaleString()} orders`}
              icon={DollarSign}
              color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="Commission Earned"
              value={fmt(data.totalCommissionCents)}
              sub={
                data.totalRevenueCents > 0
                  ? `${((data.totalCommissionCents / data.totalRevenueCents) * 100).toFixed(1)}% effective rate`
                  : undefined
              }
              icon={Percent}
              color="bg-blue-500/15 text-blue-600 dark:text-blue-400"
            />
            <StatCard
              label="Total Orders"
              value={data.totalOrders.toLocaleString()}
              icon={ShoppingCart}
              color="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            />
            <StatCard
              label="Avg Order Value"
              value={fmt(data.avgOrderValueCents)}
              icon={TrendingUp}
              color="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            />
            <StatCard
              label="Total Discounts"
              value={fmt(data.totalDiscountCents)}
              icon={Tag}
              color="bg-rose-500/15 text-rose-600 dark:text-rose-400"
            />
          </div>

          {data.platformHealth && (
            <ChartCard title="Platform health" subtitle="Live snapshots from seller, catalog, payment, review, and notification services">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sellers</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {data.platformHealth.approvedSellers.toLocaleString()} approved
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.platformHealth.pendingSellerApplications.toLocaleString()} pending ·{" "}
                    {data.platformHealth.totalSellers.toLocaleString()} total
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catalog</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {data.platformHealth.activeProducts.toLocaleString()} active
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.platformHealth.draftProducts.toLocaleString()} draft ·{" "}
                    {data.platformHealth.storesWithActiveCatalog.toLocaleString()} stores with listings
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {data.platformHealth.successfulPayments.toLocaleString()} ok
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.platformHealth.failedPayments.toLocaleString()} failed (all-time counts)
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transfers</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {data.platformHealth.pendingTransfers.toLocaleString()} pending
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(data.platformHealth.pendingTransferAmountCents)} pending ·{" "}
                    {fmt(data.platformHealth.paidTransferAmountCents)} paid out
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reviews</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {(data.platformHealth.totalReviews ?? 0).toLocaleString()} total
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(data.platformHealth.avgRating ?? 0).toFixed(2)} avg ·{" "}
                    {(data.platformHealth.reviewsLast30Days ?? 0).toLocaleString()} last 30d
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notifications</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {(data.platformHealth.activeRecipients ?? 0).toLocaleString()} active
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(data.platformHealth.totalRecipients ?? 0).toLocaleString()} routes ·{" "}
                    {(data.platformHealth.templateCount ?? 0).toLocaleString()} templates
                  </p>
                </div>
              </div>
            </ChartCard>
          )}

          <ChartCard title="Revenue & commission" subtitle="Daily totals for the selected range">
            <RevenueCommissionChart
              data={data.revenueByDay}
              narrow={narrow}
              height={chartH}
            />
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Daily orders" subtitle="Order count per day">
              <DailyOrdersChart
                data={data.revenueByDay}
                narrow={narrow}
                height={chartHSm}
              />
            </ChartCard>

            <ChartCard title="Revenue vs commission rate" subtitle="Bar = revenue · line = commission % of revenue">
              <RevenueVsRateChart
                data={dailyWithRate}
                narrow={narrow}
                height={chartHSm}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Orders by status">
              {data.ordersByStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data for this range.</p>
              ) : (
                <OrdersByStatusChart
                  data={data.ordersByStatus}
                  narrow={narrow}
                  height={Math.min(
                    400,
                    Math.max(chartHSm, data.ordersByStatus.length * (narrow ? 32 : 36)),
                  )}
                />
              )}
            </ChartCard>

            <ChartCard title="Top stores by revenue" subtitle="Store names from seller service when available">
              {topStoreRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data for this range.</p>
              ) : (
                <TopStoresChart
                  data={topStoreRows}
                  narrow={narrow}
                  height={Math.min(
                    400,
                    Math.max(chartHSm, topStoreRows.length * (narrow ? 36 : 40)),
                  )}
                  yAxisWidth={yAxisWStore}
                />
              )}
            </ChartCard>
          </div>

          {regionRows.length > 0 && (
            <ChartCard title="Revenue by region" subtitle="Region names from config service when available">
              <RevenueByRegionChart
                data={regionRows}
                narrow={narrow}
                height={Math.min(
                  400,
                  Math.max(chartHSm, regionRows.length * (narrow ? 36 : 40)),
                )}
                yAxisWidth={yAxisWRegion}
              />
            </ChartCard>
          )}
        </>
      )}
    </div>
  )
}
