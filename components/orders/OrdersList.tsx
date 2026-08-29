"use client"

/**
 * OrdersList — the shared, preview-matched Orders list body: filter pills,
 * order cards (top meta bar of ORDER PLACED / TOTAL / ORDER # + status pill,
 * an item row, and an action row of Track / View order / Buy again / Write a
 * review / Return / Receipt), and "Showing X–Y of N" pagination.
 *
 * Rendered from BOTH the standalone `/orders` page (with its own page-level
 * heading) and the account hub's `OrdersSection` (embedded, no heading), so
 * the two surfaces never visually drift. Status grouping + badge rendering
 * come from components/orders/status.tsx.
 *
 * Fetches one server page at a time (`getBuyerOrders(token, page, size)`)
 * and re-fetches on page/filter change. Filtering is client-side over the
 * current server page — the backend doesn't expose status-group filtering
 * yet — so the pager and "of N" label are only shown while unfiltered.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Package,
  Truck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Star,
  ShoppingBag,
  AlertCircle,
} from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getBuyerOrders, reorderOrder, type OrderDto, type Page } from "@/lib/api"
import { logError, friendlyMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { classifyStatus, statusBadge } from "@/components/orders/status"
import { RequestReturnButton } from "@/components/returns/RequestReturnButton"

const DEFAULT_PAGE_SIZE = 6

/* Pills match the approved preview exactly: All / Order placed / Shipped /
 * Delivered / Cancelled & refunded. ("Out for delivery" orders still show
 * up under "All" — the preview doesn't give them a dedicated pill.) */
type ListFilter = "all" | "placed" | "shipped" | "delivered" | "cancelled"

const FILTERS: { key: ListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "placed", label: "Order placed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled & refunded" },
]

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function isCancelledOrRefunded(status: string) {
  const s = status.toLowerCase()
  return s === "cancelled" || s === "refunded" || s === "payment_failed"
}

function matchesFilter(order: OrderDto, filter: ListFilter): boolean {
  if (filter === "all") return true
  if (filter === "cancelled") return isCancelledOrRefunded(order.status)
  return classifyStatus(order.status) === filter
}

export function OrdersList({ pageSize = DEFAULT_PAGE_SIZE }: { pageSize?: number }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)

  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<ListFilter>("all")
  const [data, setData] = useState<Page<OrderDto> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyingAgainId, setBuyingAgainId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = await getAccessToken()
        if (!token) {
          if (!cancelled) setError("Session expired — please sign in again")
          return
        }
        const result = await getBuyerOrders(token, page, pageSize)
        if (!cancelled) setData(result)
      } catch (e) {
        logError(e, "loading orders")
        if (!cancelled) setError(friendlyMessage(e, "Couldn't load your orders"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, pageSize])

  const allOrders = data?.content ?? []
  const orders = filter === "all" ? allOrders : allOrders.filter((o) => matchesFilter(o, filter))

  function restoreCartFromOrder(order: OrderDto): number {
    useCartStore.getState().clearCart()
    let added = 0
    for (const so of order.subOrders) {
      for (const it of so.items) {
        if (!it.productId) continue
        addItem({
          productId: it.productId,
          variantId: it.variantId,
          storeId: so.storeId,
          storeName: so.storeId,
          title: it.productTitle || "Product",
          variantName: it.variantName || "Default",
          price: it.unitPriceCents,
          quantity: it.quantity,
          imageUrl: it.imageUrl ?? undefined,
          slug: it.slug ?? it.productId,
          weightKg: null,
          lengthIn: null,
          widthIn: null,
          heightIn: null,
        })
        added++
      }
    }
    return added
  }

  async function handleBuyAgain(order: OrderDto) {
    if (buyingAgainId) return
    setBuyingAgainId(order.id)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Session expired — please sign in again")
        return
      }
      const idempotencyKey = `reorder-${order.orderNumber}-${Date.now()}`
      let res
      try {
        res = await reorderOrder(token, order.orderNumber, idempotencyKey)
      } catch (e) {
        logError(e, "1-click reorder")
        const added = restoreCartFromOrder(order)
        if (added === 0) {
          toast.error("Couldn't reorder this — try View order instead")
          return
        }
        toast.message(`Added ${added} item${added === 1 ? "" : "s"} — finish on checkout`)
        router.push("/cart")
        return
      }

      if (res.skippedItemCount > 0) {
        toast.message(
          `Reorder ready (${res.skippedItemCount} item${res.skippedItemCount === 1 ? "" : "s"} no longer available)`,
        )
      }

      if (!res.fastPath) {
        restoreCartFromOrder(order)
        if (res.fallbackReason === "no_default_address") {
          toast.message("Pick a shipping address to continue.")
        }
        router.push("/checkout")
        return
      }

      restoreCartFromOrder(order)
      if (res.checkoutSessionId) {
        router.push(`/checkout/complete?session=${encodeURIComponent(res.checkoutSessionId)}`)
      } else {
        router.push("/checkout")
      }
    } finally {
      setBuyingAgainId(null)
    }
  }

  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0
  const rangeStart = totalElements === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min(totalElements, (page + 1) * pageSize)

  return (
    <div className="space-y-5">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                isActive
                  ? "border-brand-gold bg-brand-gold/15 text-brand-gold-ink"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">No orders here yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {filter === "all"
              ? "When you place an order, it'll show up here."
              : "No orders match this filter."}
          </p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <ul className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              buyingAgain={buyingAgainId === order.id}
              onBuyAgain={() => handleBuyAgain(order)}
            />
          ))}
        </ul>
      )}

      {/* Filtering is client-side over the current page only, so the server
          pager's "of N" would be misleading while a status filter is active. */}
      {!loading && !error && totalElements > 0 && filter !== "all" && (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Showing matches on this page. Choose “All” to page through your full history.
        </p>
      )}

      {!loading && !error && totalElements > 0 && filter === "all" && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {totalElements}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-current={i === page ? "page" : undefined}
                className={cn(
                  "min-w-[28px] rounded-lg px-2 py-1.5 text-xs font-semibold",
                  i === page
                    ? "bg-brand-gold text-brand-gold-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-muted"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderCard({
  order,
  buyingAgain,
  onBuyAgain,
}: {
  order: OrderDto
  buyingAgain: boolean
  onBuyAgain: () => void
}) {
  const badge = statusBadge(order.status)
  const group = classifyStatus(order.status)
  const allItems = order.subOrders.flatMap((so) => so.items)
  const firstItem = allItems[0]
  const extraItemCount = allItems.length - 1
  const placedDate = order.placedAt || order.createdAt
  const detailsHref = `/orders/${order.orderNumber}`
  const trackingHref = `/orders/${order.orderNumber}#tracking`
  const canTrack = group === "shipped" || group === "out_for_delivery"
  const canReview = group === "delivered"
  const canReorder = group === "delivered" || isCancelledOrRefunded(order.status)
  // Returns are only offered on delivered sub-orders with items to return.
  const returnableSubOrder = group === "delivered"
    ? order.subOrders.find((so) => so.items.length > 0)
    : undefined

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-muted/40 px-4 py-3 sm:px-4.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Order placed</p>
            <p className="text-sm font-medium text-foreground">{formatDate(placedDate)}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{formatCents(order.totalCents, order.currency)}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Order #</p>
            <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap", badge.tone)}>
          <badge.Icon className="h-3 w-3" />
          {badge.label}
        </span>
      </div>

      <div className="p-4 sm:p-4.5">
        {firstItem ? (
          <Link href={detailsHref} className="flex min-w-0 items-center gap-3.5">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
              {firstItem.imageUrl ? (
                <Image src={firstItem.imageUrl} alt={firstItem.productTitle ?? "Item"} fill sizes="56px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-foreground">{firstItem.productTitle ?? "Item"}</p>
              <p className="text-xs text-muted-foreground">
                Qty {firstItem.quantity}
                {extraItemCount > 0 && ` · +${extraItemCount} more item${extraItemCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatCents(firstItem.totalPriceCents, order.currency)}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No items on this order</p>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {canTrack && (
            <Link
              href={trackingHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3.5 py-2 text-xs font-semibold text-brand-gold-foreground hover:brightness-95"
            >
              <Truck className="h-3.5 w-3.5" />
              Track package
            </Link>
          )}
          <Link
            href={detailsHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            View order
          </Link>
          {canReorder && (
            <button
              type="button"
              onClick={onBuyAgain}
              disabled={buyingAgain}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buyingAgain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Buy again
            </button>
          )}
          {canReview && (
            <Link
              href={`${detailsHref}#review`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Star className="h-3.5 w-3.5" />
              Write a review
            </Link>
          )}
          {returnableSubOrder && (
            <RequestReturnButton sub={returnableSubOrder} orderNumber={order.orderNumber} />
          )}
          <Link
            href={`${detailsHref}/receipt`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Receipt (PDF)
          </Link>
        </div>
      </div>
    </li>
  )
}
