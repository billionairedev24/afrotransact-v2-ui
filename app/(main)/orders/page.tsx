"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Loader2,
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  ReceiptText,
  Star,
} from "lucide-react"
import { getBuyerOrders, type OrderDto } from "@/lib/api"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:    { label: "Pending",    color: "text-yellow-400", bg: "bg-yellow-500/15", icon: Clock },
  paid:       { label: "Paid",       color: "text-blue-400",   bg: "bg-blue-500/15",   icon: CheckCircle },
  processing: { label: "Processing", color: "text-blue-400",   bg: "bg-blue-500/15",   icon: Package },
  shipped:    { label: "Shipped",    color: "text-purple-400", bg: "bg-purple-500/15", icon: Truck },
  delivered:  { label: "Delivered",  color: "text-green-400",  bg: "bg-green-500/15",  icon: CheckCircle },
  cancelled:  { label: "Cancelled",  color: "text-red-400",    bg: "bg-red-500/15",    icon: XCircle },
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function OrderCard({ order }: { order: OrderDto }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const allItems = order.subOrders.flatMap((so) => so.items)
  const totalItems = allItems.reduce((sum, i) => sum + i.quantity, 0)
  const placedDate = order.placedAt || order.createdAt

  return (
    <div className="rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: "hsl(0 0% 11%)" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 sm:px-5 py-3 text-[13px]"
           style={{ background: "hsl(0 0% 9%)" }}>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-400">
          <div>
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Order placed</span>
            <p className="text-gray-300 mt-0.5">{formatDate(placedDate)}</p>
          </div>
          <div>
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Total</span>
            <p className="text-white font-medium mt-0.5">{formatCents(order.totalCents, order.currency)}</p>
          </div>
          <div>
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Items</span>
            <p className="text-gray-300 mt-0.5">{totalItems}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-[11px] uppercase tracking-wider">
            Order <span className="font-mono text-gray-300">#{order.orderNumber}</span>
          </span>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-white/[0.06]">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {cfg.label}
        </span>
        {order.status === "shipped" && (
          <span className="text-xs text-gray-500">Estimated delivery in 3-5 business days</span>
        )}
        {order.status === "delivered" && (
          <span className="text-xs text-gray-500">Delivered successfully</span>
        )}
      </div>

      {/* Review prompt for delivered orders */}
      {(order.status === "delivered" || order.status === "completed" ||
        order.subOrders.some((so) => so.fulfillmentStatus === "delivered" || so.fulfillmentStatus === "completed")) && (
        <Link
          href={`/orders/${order.orderNumber}`}
          className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-transparent border-b border-white/[0.06] hover:from-yellow-500/15 transition-colors group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/15">
            <Star className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Rate your purchase</p>
            <p className="text-xs text-gray-400">Share your experience to help other shoppers</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-yellow-400 transition-colors shrink-0" />
        </Link>
      )}

      {/* Items */}
      <div className="divide-y divide-white/[0.04]">
        {allItems.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center gap-4 px-4 sm:px-5 py-4">
            <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productTitle || "Product"}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {item.productTitle || "Product"}
              </p>
              {item.variantName && (
                <p className="text-xs text-gray-500 mt-0.5">{item.variantName}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Qty: {item.quantity} &middot; {formatCents(item.unitPriceCents)} each
              </p>
            </div>
            <p className="text-sm font-medium text-white shrink-0">
              {formatCents(item.totalPriceCents)}
            </p>
          </div>
        ))}
        {allItems.length > 3 && (
          <div className="px-4 sm:px-5 py-3 text-center">
            <span className="text-xs text-gray-500">+ {allItems.length - 3} more item{allItems.length - 3 > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 sm:px-5 py-3"
           style={{ background: "hsl(0 0% 9%)" }}>
        <div className="text-xs text-gray-500">
          {order.subOrders.length > 1 && `${order.subOrders.length} stores`}
        </div>
        <Link
          href={`/orders/${order.orderNumber}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          View order details <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

const PAGE_SIZE = 10

export default function OrdersPage() {
  const session = useSession()
  const status = session?.status
  const [orders, setOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchOrders() {
      try {
        setLoading(true)
        setError(null)
        const token = await getAccessToken()
        if (!token || cancelled) return

        const res = await getBuyerOrders(token, page, PAGE_SIZE)
        if (cancelled) return
        setOrders(res.content)
        setTotalPages(res.totalPages ?? Math.ceil((res.totalElements ?? 0) / PAGE_SIZE))
        setTotalElements(res.totalElements ?? 0)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOrders()
    return () => { cancelled = true }
  }, [status, page])

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-gray-600" />
        <h1 className="text-xl font-bold text-white mt-5">Sign in to view your orders</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
          Track your purchases, view order details, and manage your order history.
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <span className="text-sm text-gray-400">Loading your orders...</span>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-red-500/20 p-8 text-center" style={{ background: "hsl(0 0% 11%)" }}>
          <XCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm text-red-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15 transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Your Orders</h1>
        {totalElements > 0 && (
          <span className="text-sm text-gray-500">{totalElements} order{totalElements !== 1 ? "s" : ""}</span>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] px-6 py-16 text-center" style={{ background: "hsl(0 0% 11%)" }}>
          <ReceiptText className="mx-auto h-14 w-14 text-gray-600" />
          <h2 className="text-lg font-semibold text-white mt-5">No orders yet</h2>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            When you place an order, it will appear here. Start exploring our marketplace to find products you love.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                disabled={page <= 0}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-30"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
