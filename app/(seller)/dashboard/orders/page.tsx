"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { ClipboardList, Loader2, Truck, Package, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/Dialog"
import { createColumnHelper } from "@tanstack/react-table"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getCurrentSeller,
  getSellerStores,
  getSellerOrders,
  updateSubOrderStatus,
  type OrderDto,
  type SubOrderDto,
} from "@/lib/api"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:    { label: "Pending",    className: "bg-yellow-500/20 text-yellow-400" },
  paid:       { label: "Paid",       className: "bg-blue-500/20 text-blue-400" },
  processing: { label: "Processing", className: "bg-purple-500/20 text-purple-400" },
  shipped:    { label: "Shipped",    className: "bg-indigo-500/20 text-indigo-400" },
  delivered:  { label: "Delivered",  className: "bg-green-500/20 text-green-400" },
  cancelled:  { label: "Cancelled",  className: "bg-red-500/20 text-red-400" },
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

const col = createColumnHelper<FlatOrder>()

export default function SellerOrdersPage() {
  const { status } = useSession()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      const token = await getAccessToken()
      if (!token || cancelled) return

      try {
        const seller = await getCurrentSeller(token)
        if (cancelled) return
        const stores = await getSellerStores(token, seller.id)
        if (cancelled || stores.length === 0) {
          setLoading(false)
          return
        }

        const sid = stores[0].id
        setStoreId(sid)

        const data = await getSellerOrders(token, sid, 0, 200)
        if (!cancelled) setOrders(data.content)
      } catch {
        if (!cancelled) toast.error("Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [status])

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
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          itemsCount,
          totalCents: order.totalCents,
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
          const b = statusBadge(info.getValue())
          return (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${b.className}`}
            >
              {info.getValue().replace(/_/g, " ")}
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
      />

      <OrderDetailModal
        order={flatOrders.find((o) => o.id === selectedOrderId) ?? null}
        onClose={() => setSelectedOrderId(null)}
        onStatusUpdated={async () => {
          if (!storeId) return
          const token = await getAccessToken()
          if (!token) return
          const data = await getSellerOrders(token, storeId, 0, 200)
          setOrders(data.content)
        }}
      />
    </div>
  )
}

const SELLER_STATUSES = ["processing", "packaged", "dispatched"] as const
const FULFILLMENT_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending:    { label: "Pending",    className: "bg-yellow-500/20 text-yellow-400", icon: <Package className="h-3.5 w-3.5" /> },
  processing: { label: "Processing", className: "bg-purple-500/20 text-purple-400", icon: <Package className="h-3.5 w-3.5" /> },
  packaged:   { label: "Packaged",   className: "bg-blue-500/20 text-blue-400",     icon: <Package className="h-3.5 w-3.5" /> },
  dispatched: { label: "Dispatched", className: "bg-indigo-500/20 text-indigo-400", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered:  { label: "Delivered",  className: "bg-green-500/20 text-green-400",   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
}

function OrderDetailModal({
  order,
  onClose,
  onStatusUpdated,
}: {
  order: FlatOrder | null
  onClose: () => void
  onStatusUpdated: () => Promise<void>
}) {
  const [updating, setUpdating] = useState(false)
  const [trackingInput, setTrackingInput] = useState("")

  if (!order) return null

  const allItems = order.relevantSubs.flatMap((sub) => sub.items)
  const currentFulfillment = order.relevantSubs[0]?.fulfillmentStatus ?? "pending"
  const subOrderId = order.relevantSubs[0]?.id

  async function handleUpdateStatus(newStatus: string) {
    if (!subOrderId) return
    setUpdating(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      await updateSubOrderStatus(token, subOrderId, newStatus, trackingInput || undefined)
      toast.success(`Status updated to ${newStatus}`)
      await onStatusUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader onClose={onClose}>
        Order {order.orderNumber}
      </DialogHeader>
      <DialogBody className="space-y-6">
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
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{formatCents(order.totalCents, order.currency)}</p>
          </div>
        </div>

        {order.raw.shippingAddress && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Shipping Address</p>
            <p className="mt-1 text-sm text-gray-600">{order.raw.shippingAddress}</p>
          </div>
        )}

        {/* Fulfillment update */}
        {subOrderId && currentFulfillment !== "delivered" && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Update Fulfillment Status</p>
            <div className="flex flex-wrap gap-2">
              {SELLER_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={updating || s === currentFulfillment}
                  onClick={() => handleUpdateStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40
                    ${s === currentFulfillment
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
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
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              />
            )}
          </div>
        )}

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Items</p>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
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
                        {item.imageUrl && <img src={item.imageUrl} alt="" className="h-8 w-8 rounded object-cover border border-gray-200" />}
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
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-500">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCents(order.totalCents, order.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </DialogBody>
    </Dialog>
  )
}
