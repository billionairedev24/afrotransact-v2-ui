"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  MapPin,
  ToggleLeft,
  Users,
  Percent,
  Store,
  Package,
  LayoutGrid,
  Megaphone,
  Loader2,
  Clock,
  Globe,
  CreditCard,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  ArrowUpRight,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"
import {
  getAdminSellers,
  getRegions,
  getAdminPlans,
  getAdminSellerStats,
  getAdminProducts,
  getAdminReviews,
  type SellerInfo,
  type OnboardingStats,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"

const CARD_BG = "#FFFFFF"

const QUICK_LINKS = [
  { href: "/admin/sellers", label: "Sellers", icon: Users, desc: "Review & manage sellers" },
  { href: "/admin/products", label: "Products", icon: Package, desc: "Browse & moderate listings" },
  { href: "/admin/categories", label: "Categories", icon: LayoutGrid, desc: "Organize product taxonomy" },
  { href: "/admin/regions", label: "Regions", icon: MapPin, desc: "Enable / disable cities" },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: ToggleLeft, desc: "Toggle features per region" },
  { href: "/admin/commission", label: "Commission", icon: Percent, desc: "Set rates per region" },
  { href: "/admin/subscription", label: "Subscriptions", icon: CreditCard, desc: "Manage plans & billing" },
  { href: "/admin/ads", label: "Ad Slots", icon: Megaphone, desc: "Manage promotional slots" },
]

export default function AdminOverviewPage() {
  const { status } = useSession()

  const [loading, setLoading] = useState(true)
  const [sellerStats, setSellerStats] = useState<OnboardingStats | null>(null)
  const [pendingApps, setPendingApps] = useState<SellerInfo[]>([])
  const [totalProducts, setTotalProducts] = useState<number | null>(null)
  const [regionCount, setRegionCount] = useState<number | null>(null)
  const [planCount, setPlanCount] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [avgRating, setAvgRating] = useState<number | null>(null)

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return }

    let cancelled = false

    async function fetchData() {
      try {
        setLoading(true)
        const token = await getAccessToken()
        if (!token || cancelled) return

        const [statsRes, pendingRes, regionsRes, plansRes, productsRes, reviewsRes] = await Promise.allSettled([
          getAdminSellerStats(token),
          getAdminSellers(token, undefined, 0, 5, "submitted"),
          getRegions(token),
          getAdminPlans(token),
          getAdminProducts(token, undefined, 0, 1),
          getAdminReviews(token, 1, 1),
        ])

        if (cancelled) return

        if (statsRes.status === "fulfilled") setSellerStats(statsRes.value)
        if (pendingRes.status === "fulfilled") setPendingApps(pendingRes.value.content)
        if (regionsRes.status === "fulfilled") setRegionCount(regionsRes.value.length)
        if (plansRes.status === "fulfilled") setPlanCount(plansRes.value.length)
        if (productsRes.status === "fulfilled") setTotalProducts(productsRes.value.totalElements)
        if (reviewsRes.status === "fulfilled") {
          setReviewCount(reviewsRes.value.review_count ?? reviewsRes.value.total ?? 0)
          setAvgRating(reviewsRes.value.avg_rating ?? 0)
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load admin data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [status])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-gray-500">Loading dashboard...</span>
      </div>
    )
  }

  const totalSellers = sellerStats?.totalSellers ?? 0
  const approvedSellers = sellerStats?.approved ?? 0
  const pendingSellers = (sellerStats?.started ?? 0) + (sellerStats?.inProgress ?? 0)
  const submittedSellers = (sellerStats?.submitted ?? 0) + (sellerStats?.underReview ?? 0)
  const needsAction = sellerStats?.needsAction ?? 0
  const rejectedSellers = sellerStats?.rejected ?? 0

  const statCards = [
    { label: "Total Sellers", value: totalSellers, icon: Store, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Pending", value: pendingSellers, icon: Clock, color: "text-gray-400", bgColor: "bg-gray-500/10" },
    { label: "Submitted", value: submittedSellers, icon: Clock, color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
    { label: "Approved", value: approvedSellers, icon: CheckCircle2, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
    { label: "Total Products", value: totalProducts ?? 0, icon: Package, color: "text-blue-400", bgColor: "bg-blue-500/10" },
    { label: "Active Regions", value: regionCount ?? 0, icon: Globe, color: "text-violet-400", bgColor: "bg-violet-500/10" },
    { label: "Reviews", value: reviewCount ?? 0, icon: Star, color: "text-amber-400", bgColor: "bg-amber-500/10" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform health and key metrics at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-2xl border border-gray-100 p-5" style={{ background: CARD_BG }}>
              <div className={`inline-flex rounded-xl p-2.5 ${card.bgColor} mb-3`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seller Status Donut */}
        {sellerStats && (
          <div className="rounded-2xl border border-gray-100 p-6" style={{ background: CARD_BG }}>
            <h3 className="text-sm font-semibold text-gray-900 mb-5">Seller Status Distribution</h3>
            <SellerDonut stats={sellerStats} />
          </div>
        )}

        {/* Onboarding Funnel */}
        {sellerStats && (
          <div className="rounded-2xl border border-gray-100 p-6" style={{ background: CARD_BG }}>
            <h3 className="text-sm font-semibold text-gray-900 mb-5">Onboarding Funnel</h3>
            <FunnelChart stats={sellerStats} />
          </div>
        )}

        {/* Platform Health */}
        <div className="rounded-2xl border border-gray-100 p-6" style={{ background: CARD_BG }}>
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Platform Health</h3>
          <div className="space-y-4">
            <HealthMetric
              label="Approval Rate"
              value={totalSellers > 0 ? Math.round((approvedSellers / totalSellers) * 100) : 0}
              suffix="%"
              color="text-emerald-400"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <HealthMetric
              label="Avg Rating"
              value={avgRating ?? 0}
              suffix="/5"
              color="text-amber-400"
              icon={<Star className="h-4 w-4" />}
            />
            <HealthMetric
              label="Rejection Rate"
              value={totalSellers > 0 ? Math.round((rejectedSellers / totalSellers) * 100) : 0}
              suffix="%"
              color="text-red-400"
              icon={<XCircle className="h-4 w-4" />}
            />
            <HealthMetric
              label="Needs Attention"
              value={needsAction + submittedSellers}
              suffix=" sellers"
              color="text-orange-400"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <HealthMetric
              label="Subscription Plans"
              value={planCount ?? 0}
              suffix=" active"
              color="text-violet-400"
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      {/* Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Applications */}
        <div className="rounded-2xl border border-gray-100" style={{ background: CARD_BG }}>
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Pending Applications</h2>
            <Link href="/admin/sellers" className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingApps.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/30" />
                <p className="mt-2 text-sm text-gray-500">No pending applications</p>
              </div>
            ) : (
              pendingApps.map((s) => (
                <Link key={s.id} href="/admin/sellers" className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                      <Store className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.businessName}</p>
                      <p className="text-xs text-gray-500">Applied {new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                    Review
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Seller Status Bar Chart */}
        {sellerStats && (
          <div className="rounded-2xl border border-gray-100 p-6" style={{ background: CARD_BG }}>
            <h3 className="text-sm font-semibold text-gray-900 mb-5">Seller Status Breakdown</h3>
            <HorizontalBarChart stats={sellerStats} />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 p-4 hover:border-gray-300 transition-all"
                style={{ background: CARD_BG }}
              >
                <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-gray-900 font-semibold text-sm group-hover:text-primary transition-colors">{link.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{link.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Donut Chart ─────────────────────────────────────────────────────────── */

function SellerDonut({ stats }: { stats: OnboardingStats }) {
  const segments = [
    { label: "Approved", value: stats.approved, color: "#34d399" },
    { label: "Submitted", value: stats.submitted, color: "#facc15" },
    { label: "In Review", value: stats.underReview, color: "#60a5fa" },
    { label: "Pending", value: stats.inProgress + stats.started, color: "#94a3b8" },
    { label: "Requires Info", value: stats.needsAction, color: "#fb923c" },
    { label: "Rejected", value: stats.rejected, color: "#f87171" },
  ].filter((s) => s.value > 0)

  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) return <p className="text-sm text-gray-500 text-center py-8">No sellers yet</p>

  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {segments.map((seg) => {
            const dash = C * (seg.value / total)
            const cur = offset
            offset += dash
            return (
              <circle
                key={seg.label}
                cx="50" cy="50" r={R}
                fill="none" stroke={seg.color} strokeWidth="12"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-cur}
                strokeLinecap="round"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Sellers</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 w-full">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-gray-500 flex-1">{seg.label}</span>
            <span className="text-gray-900 font-medium">{seg.value}</span>
            <span className="text-gray-600 w-8 text-right">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Funnel Chart ────────────────────────────────────────────────────────── */

function FunnelChart({ stats }: { stats: OnboardingStats }) {
  const steps = [
    { label: "Registered", value: stats.totalSellers, color: "#a78bfa" },
    { label: "Started Onboarding", value: stats.started + stats.inProgress + stats.submitted + stats.approved + stats.rejected + stats.needsAction, color: "#38bdf8" },
    { label: "Submitted", value: stats.submitted + stats.approved + stats.rejected + stats.needsAction, color: "#facc15" },
    { label: "Approved", value: stats.approved, color: "#34d399" },
  ]

  const max = steps[0]?.value || 1

  return (
    <div className="space-y-3">
      {steps.map((step, _i) => {
        const pct = max > 0 ? (step.value / max) * 100 : 0
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{step.label}</span>
              <span className="text-xs font-medium text-gray-900">{step.value}</span>
            </div>
            <div className="h-7 w-full rounded-lg overflow-hidden" style={{ background: "#f3f4f6" }}>
              <div
                className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(pct, 3)}%`, background: step.color }}
              >
                {pct > 15 && (
                  <span className="text-[10px] font-semibold text-black/70">{Math.round(pct)}%</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {max > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">Conversion Rate</span>
          <span className="text-sm font-bold text-emerald-400">
            {Math.round(((steps[3]?.value ?? 0) / max) * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}

/* ─── Horizontal Bar Chart ────────────────────────────────────────────────── */

function HorizontalBarChart({ stats }: { stats: OnboardingStats }) {
  const bars = [
    { label: "Pending", value: stats.started + stats.inProgress, color: "#94a3b8", icon: <Clock className="h-3.5 w-3.5" /> },
    { label: "Submitted", value: stats.submitted, color: "#facc15", icon: <ShoppingCart className="h-3.5 w-3.5" /> },
    { label: "In Review", value: stats.underReview, color: "#60a5fa", icon: <Clock className="h-3.5 w-3.5" /> },
    { label: "Approved", value: stats.approved, color: "#34d399", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { label: "Requires Info", value: stats.needsAction, color: "#fb923c", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { label: "Rejected", value: stats.rejected, color: "#f87171", icon: <XCircle className="h-3.5 w-3.5" /> },
  ]

  const max = Math.max(...bars.map((b) => b.value), 1)

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-28 shrink-0">
            <span style={{ color: bar.color }}>{bar.icon}</span>
            <span className="text-xs text-gray-500 truncate">{bar.label}</span>
          </div>
          <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "#f3f4f6" }}>
            <div
              className="h-full rounded-md transition-all duration-700"
              style={{ width: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 5 : 0)}%`, background: bar.color }}
            />
          </div>
          <span className="text-xs font-medium text-gray-900 w-8 text-right">{bar.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Health Metric ───────────────────────────────────────────────────────── */

function HealthMetric({
  label, value, suffix, color, icon,
}: {
  label: string; value: number; suffix: string; color: string; icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={color}>{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${color}`}>
        {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}{suffix}
      </span>
    </div>
  )
}
