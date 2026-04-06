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
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  ReceiptText,
  Star,
  AlertTriangle,
} from "lucide-react"
import { getBuyerOrders, type OrderDto } from "@/lib/api"
import { logError } from "@/lib/errors"
import { getStatusStyle } from "@/lib/status-config"
import { OrderCardSkeleton } from "@/components/ui/Skeleton"

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending:    Clock,
  awaiting_payment: AlertTriangle,
  payment_failed: XCircle,
  paid:       CheckCircle,
  confirmed:  CheckCircle,
  processing: Package,
  packaged:   Package,
  dispatched: Truck,
  shipped:    Truck,
  out_for_delivery: Truck,
  delivered:  CheckCircle,
  completed:  CheckCircle,
  cancelled:  XCircle,
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
  const cfg = getStatusStyle(order.status)
  const StatusIcon = STATUS_ICONS[order.status.toLowerCase()] ?? Clock
  const allItems = order.subOrders.flatMap((so) => so.items)
  const totalItems = allItems.reduce((sum, i) => sum + i.quantity, 0)
  const placedDate = order.placedAt || order.createdAt

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 sm:px-5 py-3 text-[13px]">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-500">
          <div>
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Order placed</span>
            <p className="text-gray-600 mt-0.5">{formatDate(placedDate)}</p>
          </div>
          <div>
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Total</span>
            <p className="text-gray-900 font-medium mt-0.5">{formatCents(order.totalCents, order.currency)}</p>
          </div>
          <div>
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Items</span>
            <p className="text-gray-600 mt-0.5">{totalItems}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(order.discountCents ?? 0) > 0 && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
              Discount applied
            </span>
          )}
          <span className="text-gray-500 text-[11px] uppercase tracking-wider">
            Order <span className="font-mono text-gray-600">#{order.orderNumber}</span>
          </span>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-gray-200">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
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
          className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-transparent border-b border-gray-200 hover:from-yellow-500/15 transition-colors group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/15">
            <Star className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Rate your purchase</p>
            <p className="text-xs text-gray-500">Share your experience to help other shoppers</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-yellow-400 transition-colors shrink-0" />
        </Link>
      )}

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {allItems.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center gap-4 px-4 sm:px-5 py-4">
            <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
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
              <p className="text-sm font-medium text-gray-900 truncate">
                {item.productTitle || "Product"}
              </p>
              {item.variantName && (
                <p className="text-xs text-gray-500 mt-0.5">{item.variantName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Qty: {item.quantity} &middot; {formatCents(item.unitPriceCents)} each
              </p>
            </div>
            <p className="text-sm font-medium text-gray-900 shrink-0">
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
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 sm:px-5 py-3">
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
        logError(e, "loading orders")
        if (!cancelled) setError("Failed to load orders")
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
        <h1 className="text-xl font-bold text-gray-900 mt-5">Sign in to view your orders</h1>
        <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
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
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((k) => <OrderCardSkeleton key={k} />)}
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-red-500/20 bg-white p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-600" />
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-200 transition-colors"
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
        <h1 className="text-2xl font-bold text-gray-900">Your Orders</h1>
        {totalElements > 0 && (
          <span className="text-sm text-gray-500">{totalElements} order{totalElements !== 1 ? "s" : ""}</span>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <ReceiptText className="mx-auto h-14 w-14 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900 mt-5">No orders yet</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
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
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30"
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
