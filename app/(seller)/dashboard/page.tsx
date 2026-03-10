"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  Package,
  ShoppingCart,
  ArrowRight,
  Loader2,
  Settings,
  CreditCard,
  AlertCircle,
  Store,
  Plus,
  TrendingUp,
  DollarSign,
} from "lucide-react"
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
import {
  getCurrentSeller,
  getSellerStores,
  getStoreProducts,
  getSellerOrders,
  getSubscription,
  type SellerInfo,
  type StoreDetail,
  type OrderDto,
  type SellerSubscription,
} from "@/lib/api"

const PRIMARY = "hsl(45 93% 58%)"
const CARD_BG = "#FFFFFF"
const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
}

const PIE_COLORS: Record<string, string> = {
  pending: "hsl(45 93% 58%)",
  processing: "hsl(200 80% 55%)",
  shipped: "hsl(160 70% 45%)",
  delivered: "hsl(145 60% 50%)",
  cancelled: "hsl(0 70% 55%)",
}

function buildSalesData(orders: any[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const map: Record<string, number> = {}
  for (const d of days) map[d] = 0
  for (const o of orders) {
    const date = new Date(o.placedAt || o.createdAt)
    const day = days[date.getDay()]
    map[day] += (o.totalCents ?? 0) / 100
  }
  return days.map((day) => ({ day, sales: Math.round(map[day]) }))
}

function statusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "delivered":
      return "bg-green-500/10 text-green-400"
    case "shipped":
    case "processing":
      return "bg-blue-500/10 text-blue-400"
    case "cancelled":
      return "bg-red-500/10 text-red-400"
    default:
      return "bg-yellow-500/10 text-yellow-400"
  }
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export default function DashboardOverview() {
  const { status } = useSession()
  const router = useRouter()

  const [seller, setSeller] = useState<SellerInfo | null>(null)
  const [stores, setStores] = useState<StoreDetail[]>([])
  const [productCount, setProductCount] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [recentOrders, setRecentOrders] = useState<OrderDto[]>([])
  const [subscription, setSubscription] = useState<SellerSubscription | null>(null)
  const [allOrders, setAllOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      const token = await getAccessToken()
      if (!token) return
      try {
        setError(null)
        const sellerRes = await getCurrentSeller(token)
        if (cancelled) return

        const onbStatus = sellerRes.onboardingStatus?.toLowerCase()
        if (onbStatus && onbStatus !== "approved" && onbStatus !== "completed") {
          router.replace("/dashboard/onboarding")
          return
        }

        setSeller(sellerRes)

        const [storesRes, subRes] = await Promise.all([
          getSellerStores(token, sellerRes.id),
          getSubscription(token).catch(() => null),
        ])

        if (cancelled) return

        setStores(storesRes)
        setSubscription(subRes)

        if (storesRes.length === 0) {
          setLoading(false)
          return
        }

        const allStoreIds = storesRes.map((s) => s.id)
        const [productsPages, ordersPages] = await Promise.all([
          Promise.all(allStoreIds.map((id) => getStoreProducts(id, 0, 1))),
          Promise.all(allStoreIds.map((id) => getSellerOrders(token, id, 0, 50))),
        ])

        if (cancelled) return

        const totalProducts = productsPages.reduce((sum, p) => sum + p.totalElements, 0)
        const allOrders = ordersPages.flatMap((p) => p.content)
        const totalOrders = ordersPages.reduce((sum, p) => sum + p.totalElements, 0)

        setProductCount(totalProducts)
        setOrderCount(totalOrders)
        setAllOrders(allOrders)
        setRecentOrders(allOrders.slice(0, 10))
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes("404") || msg.includes("not found") || msg.toLowerCase().includes("seller")) {
            router.replace("/dashboard/onboarding")
            return
          }
          setError(msg || "Failed to load dashboard")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [status, router])

  const totalRevenueCents = useMemo(
    () => allOrders.reduce((sum, o) => sum + o.totalCents, 0),
    [allOrders],
  )

  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = {}
    recentOrders.forEach((o) => {
      const s = o.status.toLowerCase()
      counts[s] = (counts[s] || 0) + 1
    })
    return Object.entries(counts).map(([key, val]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: val,
      color: PIE_COLORS[key] || "hsl(0 0% 40%)",
    }))
  }, [recentOrders])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-gray-500">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    const isNotSeller = error.includes("404") || error.toLowerCase().includes("seller not found")
    if (isNotSeller) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Store className="h-14 w-14 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold text-foreground">No Seller Account Found</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            You haven&apos;t registered as a seller yet. Start selling on AfroTransact by
            creating your seller account — it only takes a few minutes.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Package className="h-4 w-4" />
              Start Selling
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="mt-3 text-sm font-medium text-foreground">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We couldn&apos;t load your dashboard right now. Please try again in a moment.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  const subStatus = subscription?.status ?? "none"
  const subPlan = subscription?.plan?.name ?? "No plan"

  const statsCards = [
    {
      label: "Total Products",
      value: productCount.toLocaleString(),
      icon: Package,
      color: "text-blue-400",
    },
    {
      label: "Total Orders",
      value: orderCount.toLocaleString(),
      icon: ShoppingCart,
      color: "text-purple-400",
    },
    {
      label: "Revenue",
      value: formatCents(totalRevenueCents),
      icon: DollarSign,
      color: "text-emerald-400",
    },
    {
      label: "Active Stores",
      value: stores.length.toLocaleString(),
      icon: Store,
      color: "text-yellow-400",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{seller?.businessName ? `, ${seller.businessName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your store performance
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${
            subStatus === "active" || subStatus === "trialing"
              ? "bg-green-500/10 text-green-400"
              : subStatus === "past_due"
              ? "bg-yellow-500/10 text-yellow-400"
              : "bg-gray-50 text-gray-500"
          }`}
        >
          {subPlan}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-200 p-5 min-h-[120px] flex flex-col justify-between"
              style={{ background: CARD_BG }}
            >
              <div className="flex items-start justify-between">
                <Icon className={`h-5 w-5 ${card.color}`} />
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 mt-3">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-2xl border border-gray-200 p-5"
          style={{ background: CARD_BG }}
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Sales Trend (7 days)</h2>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buildSalesData(recentOrders)}>
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
                  formatter={(value: number | string | any) => [`$${value?.toLocaleString() ?? "0"}`, "Sales"]}
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
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-200 p-5"
          style={{ background: CARD_BG }}
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Status Breakdown</h2>
          {orderStatusData.length === 0 ? (
            <div className="h-[240px] flex flex-col items-center justify-center text-center">
              <ShoppingCart className="h-10 w-10 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">No orders yet</p>
              <p className="text-xs text-gray-600 mt-1">Order status will appear here once you receive orders</p>
            </div>
          ) : (
            <div className="h-[240px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {orderStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "#9ca3af" }}
                    formatter={(value: any, name: any) => [value ?? "0", name ?? ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 pr-2 shrink-0">
                {orderStatusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: s.color }}
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">{s.name}</span>
                    <span className="text-xs font-medium text-gray-900 ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          className="rounded-2xl border border-gray-200 lg:col-span-2"
          style={{ background: CARD_BG }}
        >
          <div className="flex items-center justify-between border-b border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentOrders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-gray-600" />
                <p className="mt-2 text-sm text-gray-500">No orders yet</p>
              </div>
            ) : (
              recentOrders.map((order) => {
                const itemCount = order.subOrders.reduce(
                  (sum, so) => sum + so.items.reduce((s, i) => s + i.quantity, 0),
                  0
                )
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between px-5 py-3.5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-gray-500">
                        {order.orderNumber}
                      </span>
                      <span className="hidden text-xs text-gray-500 sm:inline">
                        {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCents(order.totalCents, order.currency)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClasses(order.status)}`}
                      >
                        {order.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-200"
          style={{ background: CARD_BG }}
        >
          <div className="border-b border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <Link
              href="/dashboard/products"
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Add Product</p>
                <p className="text-xs text-gray-500">Create a new listing</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-gray-500" />
            </Link>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">View All Orders</p>
                <p className="text-xs text-gray-500">Track &amp; fulfill</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-gray-500" />
            </Link>
            <Link
              href="/dashboard/store"
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Store Settings</p>
                <p className="text-xs text-gray-500">Logo, address, delivery</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-gray-500" />
            </Link>
            <Link
              href="/dashboard/subscription"
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Subscription</p>
                <p className="text-xs text-gray-500">Plan &amp; billing</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-gray-500" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
