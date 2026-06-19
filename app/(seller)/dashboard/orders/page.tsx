"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { ClipboardList, Loader2, Truck, Package, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import { Sheet, SheetHeader, SheetBody } from "@/components/ui/Sheet"
import { createColumnHelper } from "@tanstack/react-table"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getCurrentSeller,
  getSellerStores,
  getSellerOrders,
  updateSubOrderStatus,
  type OrderDto,
  type SubOrderDto,
  type Page as ApiPage,
} from "@/lib/api"
import { useSelectedStoreId } from "@/hooks/useSelectedStoreId"
import { formatShippingAddressLines } from "@/lib/format-address"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:    { label: "Pending",    className: "bg-yellow-50 text-yellow-700" },
  paid:       { label: "Paid",       className: "bg-blue-50 text-blue-700" },
  processing: { label: "Processing", className: "bg-purple-50 text-purple-700" },
  shipped:    { label: "Shipped",    className: "bg-indigo-50 text-indigo-700" },
  delivered:  { label: "Delivered",  className: "bg-green-50 text-green-700" },
  cancelled:  { label: "Cancelled",  className: "bg-red-50 text-red-700" },
}

const FULFILLMENT_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending:             { label: "Pending",          className: "bg-yellow-50 text-yellow-700",  icon: <Package className="h-3.5 w-3.5" /> },
  processing:          { label: "Processing",       className: "bg-purple-50 text-purple-700",  icon: <Package className="h-3.5 w-3.5" /> },
  packaged:            { label: "Packaged",         className: "bg-blue-50 text-blue-700",      icon: <Package className="h-3.5 w-3.5" /> },
  dispatched:          { label: "Dispatched",       className: "bg-indigo-50 text-indigo-700",  icon: <Truck className="h-3.5 w-3.5" /> },
  out_for_delivery:    { label: "Out for Delivery", className: "bg-sky-50 text-sky-700",        icon: <Truck className="h-3.5 w-3.5" /> },
  delivered:           { label: "Delivered",        className: "bg-green-50 text-green-700",    icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  delivery_exception:  { label: "Exception",        className: "bg-red-50 text-red-700",        icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  returned:            { label: "Returned",         className: "bg-orange-50 text-orange-700",  icon: <Package className="h-3.5 w-3.5" /> },
}

function statusBadge(status: string) {
  const key = status.toLowerCase()
  return (
    STATUS_BADGE[key] ?? {
      label: status.replace(/_/g, " "),
      className: "bg-gray-100 text-gray-500",
    }
  )
}

function fulfillmentBadge(status: string) {
  const key = status.toLowerCase()
  return (
    FULFILLMENT_BADGE[key] ?? {
      label: status.replace(/_/g, " "),
      className: "bg-gray-100 text-gray-500",
      icon: null,
    }
  )
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface FlatOrder {
  id: string
  orderNumber: string
  status: string
  itemsCount: number
  totalCents: number
  currency: string
  fulfillmentStatus: string
  placedAt: string
  raw: OrderDto
  relevantSubs: SubOrderDto[]
}

function subOrderCustomerTotal(sub: SubOrderDto): number {
  if (typeof sub.totalCents === "number") return sub.totalCents
  const discount = sub.discountCents ?? 0
  const shipping = sub.shippingCostCents ?? 0
  const tax = sub.taxCents ?? 0
  return sub.subtotalCents + shipping + tax - discount
}

const col = createColumnHelper<FlatOrder>()

const SELLER_STORE_KEY = "seller-store"
const SELLER_ORDERS_KEY = "seller-orders"

export default function SellerOrdersPage() {
  const { status } = useSession()
  const queryClient = useQueryClient()
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Resolve the seller's selected store from the StoreSwitcher (falls back to
  // their primary store when no explicit selection exists).
  const selectedStore = useSelectedStoreId()
  const storeQuery = { isLoading: selectedStore.isLoading, isFetched: !selectedStore.isLoading, data: selectedStore.storeId, error: selectedStore.isError ? new Error("store load failed") : null }
  const storeId = selectedStore.storeId

  const ordersQuery = useQuery<ApiPage<OrderDto>>({
    queryKey: [SELLER_ORDERS_KEY, storeId, pageIndex, pageSize],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getSellerOrders(token, storeId!, pageIndex, pageSize)
    },
    enabled: status === "authenticated" && !!storeId,
    placeholderData: keepPreviousData,
  })

  const orders = useMemo(() => ordersQuery.data?.content ?? [], [ordersQuery.data])
  const totalElements = ordersQuery.data?.totalElements ?? 0
  const totalPages = ordersQuery.data?.totalPages ?? 0
  const loading = storeQuery.isLoading || ordersQuery.isLoading || ordersQuery.isFetching

  function applyOrderUpdate(updated: OrderDto) {
    queryClient.setQueryData<ApiPage<OrderDto>>(
      [SELLER_ORDERS_KEY, storeId, pageIndex, pageSize],
      (prev) => prev ? { ...prev, content: prev.content.map((o) => (o.id === updated.id ? updated : o)) } : prev,
    )
  }

  const flatOrders = useMemo<FlatOrder[]>(() => {
    if (!storeId) return []
    return orders
      .map((order) => {
        const subs = order.subOrders.filter((so) => so.storeId === storeId)
        if (subs.length === 0) return null
        const itemsCount = subs.reduce(
          (sum, so) => sum + so.items.reduce((s, i) => s + i.quantity, 0),
          0,
        )
        const sellerViewTotal = subs.reduce((sum, so) => sum + subOrderCustomerTotal(so), 0)
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          itemsCount,
          totalCents: sellerViewTotal,
          currency: order.currency,
          fulfillmentStatus: subs[0]?.fulfillmentStatus ?? "—",
          placedAt: order.placedAt || order.createdAt,
          raw: order,
          relevantSubs: subs,
        }
      })
      .filter(Boolean) as FlatOrder[]
  }, [orders, storeId])

  const columns = useMemo(
    () => [
      col.accessor("orderNumber", {
        header: "Order",
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-gray-900">
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor("placedAt", {
        header: "Date",
        cell: (info) => (
          <span className="text-gray-500">{formatDate(info.getValue())}</span>
        ),
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => {
          const b = statusBadge(info.getValue())
          return (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}
            >
              {b.label}
            </span>
          )
        },
      }),
      col.accessor("itemsCount", {
        header: "Items",
        cell: (info) => (
          <span className="text-gray-600">{info.getValue()}</span>
        ),
      }),
      col.accessor("totalCents", {
        header: "Total",
        cell: (info) => (
          <span className="font-medium text-gray-900">
            {formatCents(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      col.accessor("fulfillmentStatus", {
        header: "Fulfillment",
        cell: (info) => {
          const b = fulfillmentBadge(info.getValue())
          return (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${b.className}`}
            >
              {b.icon}
              {b.label}
            </span>
          )
        },
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original
          const actions: RowAction[] = [
            {
              label: "View Details",
              icon: <ClipboardList />,
              onClick: () => setSelectedOrderId(row.id),
            },
          ]
          return <RowActions actions={actions} />
        },
        enableSorting: false,
        enableHiding: false,
      }),
    ],
    [],
  )

  if (!storeQuery.isLoading && storeQuery.isFetched && storeId === null && !storeQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center px-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">No active store found</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            Orders are scoped to your primary storefront. Create or activate at least one store, then reload this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your store orders
        </p>
      </div>

      <DataTable
        columns={columns}
        data={flatOrders}
        loading={loading}
        searchPlaceholder="Search orders…"
        searchColumn="orderNumber"
        enableExport
        exportFilename="seller-orders"
        emptyMessage="No orders yet. Orders from your store will appear here."
        pageSize={pageSize}
        serverPagination={{
          pageIndex,
          pageSize,
          pageCount: totalPages,
          totalRows: totalElements,
          onPageChange: setPageIndex,
          onPageSizeChange: (n) => { setPageSize(n); setPageIndex(0) },
        }}
      />

      <OrderDetailModal
        order={flatOrders.find((o) => o.id === selectedOrderId) ?? null}
        onClose={() => setSelectedOrderId(null)}
        onStatusUpdated={applyOrderUpdate}
      />
    </div>
  )
}

const SELLER_STATUSES = ["processing", "packaged", "dispatched"] as const

function OrderDetailModal({
  order,
  onClose,
  onStatusUpdated,
}: {
  order: FlatOrder | null
  onClose: () => void
  onStatusUpdated: (updated: OrderDto) => void
}) {
  const [updating, setUpdating] = useState(false)
  const [trackingInput, setTrackingInput] = useState("")
  const allItems = order ? order.relevantSubs.flatMap((sub) => sub.items) : []
  const currentFulfillment = order?.relevantSubs[0]?.fulfillmentStatus ?? "pending"
  const subOrderId = order?.relevantSubs[0]?.id

  async function handleUpdateStatus(newStatus: string) {
    if (!subOrderId) return
    setUpdating(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const updated = await updateSubOrderStatus(token, subOrderId, newStatus, trackingInput || undefined)
      toast.success(`Status updated to ${newStatus}`)
      onStatusUpdated(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Sheet open={!!order} onClose={onClose}>
      <SheetHeader onClose={onClose}>
        {order ? `Order ${order.orderNumber}` : "Order Details"}
      </SheetHeader>
      <SheetBody className="space-y-6">
        {order && (
          <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Order Status</p>
            <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(order.status).className}`}>
              {statusBadge(order.status).label}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Fulfillment</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${(FULFILLMENT_BADGE[currentFulfillment] || statusBadge(currentFulfillment)).className}`}>
              {FULFILLMENT_BADGE[currentFulfillment]?.icon}
              {currentFulfillment.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Placed</p>
            <p className="mt-1 text-sm text-gray-600">{formatDate(order.placedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Your storefront</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{formatCents(order.totalCents, order.currency)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Including tax &amp; shipping for your items</p>
          </div>
        </div>

        {/* Privacy: sellers see only the buyer's name during the pickup-only
            beta — full shipping address, phone, and email are withheld so
            sellers can't bypass the platform to contact buyers directly. The
            address comes back to this view once we enable real shipping
            (carrier label generation + tracking) and the seller actually
            needs it to ship. */}
        {(() => {
          const lines = formatShippingAddressLines(order.raw.shippingAddress)
          if (lines.length === 0) return null
          return (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Buyer</p>
              <p className="mt-1 text-sm text-gray-600">{lines[0] /* fullName */}</p>
              <p className="mt-1 text-[11px] text-gray-400 italic">
                Delivery details withheld — pickup arranged by AfroTransact.
              </p>
            </div>
          )
        })()}

        <div className="rounded-xl border border-input bg-gray-50 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer payment (whole order)</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono tabular-nums text-gray-900">{formatCents(order.raw.subtotalCents, order.currency)}</span>
            </div>
            {(order.raw.discountCents ?? 0) > 0 && (
              <div className="flex justify-between gap-4 text-green-700">
                <span>
                  {order.raw.couponCode ? `Coupon (${order.raw.couponCode})` : "Coupon / savings"}
                </span>
                <span className="font-mono tabular-nums">−{formatCents(order.raw.discountCents ?? 0, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Tax collected</span>
              <span className="font-mono tabular-nums text-gray-900">{formatCents(order.raw.taxCents ?? 0, order.currency)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Shipping collected</span>
              <span className="font-mono tabular-nums text-gray-900">{formatCents(order.raw.shippingCostCents ?? 0, order.currency)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-input pt-2 font-semibold text-gray-900">
              <span>Order total</span>
              <span className="font-mono tabular-nums">{formatCents(order.raw.totalCents, order.currency)}</span>
            </div>
          </div>
        </div>

        {(() => {
          const slice = order.relevantSubs.reduce(
            (acc, sub) => {
              acc.sub += sub.subtotalCents
              acc.shipping += sub.shippingCostCents ?? 0
              acc.tax += sub.taxCents ?? 0
              acc.disc += sub.discountCents ?? 0
              return acc
            },
            { sub: 0, shipping: 0, tax: 0, disc: 0 },
          )
          const sliceTotal = slice.sub + slice.shipping + slice.tax - slice.disc
          return (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-700">Your store on this order</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Subtotal (your items)</span>
                  <span className="font-mono tabular-nums text-gray-900">{formatCents(slice.sub, order.currency)}</span>
                </div>
                {slice.disc > 0 && (
                  <div className="flex justify-between gap-4 text-green-700">
                    <span>Coupon / discounts attributed here</span>
                    <span className="font-mono tabular-nums">−{formatCents(slice.disc, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Shipping (your shipments)</span>
                  <span className="font-mono tabular-nums text-gray-900">{formatCents(slice.shipping, order.currency)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Tax attributed to your subtotal</span>
                  <span className="font-mono tabular-nums text-gray-900">{formatCents(slice.tax, order.currency)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-primary/15 pt-2 font-semibold text-gray-900">
                  <span>Your storefront total</span>
                  <span className="font-mono tabular-nums">{formatCents(sliceTotal, order.currency)}</span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Fulfillment update */}
        {/* Once dispatched the delivery team takes over — show read-only notice */}
        {subOrderId && ["out_for_delivery", "delivery_exception"].includes(currentFulfillment) && (
          <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
            <Truck className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
            <p className="text-xs text-sky-700">
              <span className="font-semibold">Order is with the delivery team.</span>{" "}
              Further status updates are handled by our logistics team.
            </p>
          </div>
        )}

        {subOrderId && !["delivered", "returned", "out_for_delivery", "delivery_exception"].includes(currentFulfillment) && (
          <div className="rounded-xl border border-input bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Update Fulfillment Status</p>
            <div className="flex flex-wrap gap-2">
              {SELLER_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={updating || s === currentFulfillment}
                  onClick={() => handleUpdateStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40
                    ${s === currentFulfillment
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-input text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
                >
                  {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (FULFILLMENT_BADGE[s]?.icon ?? <Package className="h-3.5 w-3.5" />)}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {(currentFulfillment === "packaged" || currentFulfillment === "dispatched") && (
              <input
                type="text"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Tracking number (optional)"
                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              />
            )}
          </div>
        )}

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Items</p>
          <div className="overflow-hidden rounded-lg border border-input">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-input bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Product</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Unit Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && (
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-input">
                            <Image
                              src={item.imageUrl}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <p className="text-gray-600">{item.productTitle || item.variantName || "Product"}</p>
                          {item.variantName && item.productTitle && <p className="text-xs text-gray-500">{item.variantName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{formatCents(item.unitPriceCents, order.currency)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCents(item.unitPriceCents * item.quantity, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-input">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-500">Items subtotal</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    {formatCents(allItems.reduce((acc, item) => acc + item.unitPriceCents * item.quantity, 0), order.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
          </>
        )}
      </SheetBody>
    </Sheet>
  )
}
