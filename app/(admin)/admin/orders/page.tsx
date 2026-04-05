"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import {
  ClipboardList,
  Loader2,
  Eye,
  CreditCard,
  Package,
  Truck,
} from "lucide-react"
import { getStatusStyle } from "@/lib/status-config"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import { Sheet, SheetHeader, SheetBody } from "@/components/ui/Sheet"
import { createColumnHelper } from "@tanstack/react-table"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getAdminOrders,
  updateSubOrderStatus,
  type OrderDto,
} from "@/lib/api"

function statusBadge(status: string) {
  const s = getStatusStyle(status)
  return { label: s.label, className: `${s.bg} ${s.text}` }
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function subOrderCustomerTotal(sub: OrderDto["subOrders"][number]) {
  if (typeof sub.totalCents === "number") return sub.totalCents
  const discount = sub.discountCents ?? 0
  const shipping = sub.shippingCostCents ?? 0
  const tax = sub.taxCents ?? 0
  return sub.subtotalCents + shipping + tax - discount
}

interface FlatOrder {
  id: string
  orderNumber: string
  status: string
  fulfillmentStatus: string
  itemsCount: number
  totalCents: number
  currency: string
  placedAt: string
  raw: OrderDto
}

const col = createColumnHelper<FlatOrder>()

// Statuses only the admin/delivery team can set.
// "processing" and "packaged" are seller-only — they are shown read-only here.
const ADMIN_STATUSES = [
  { value: "dispatched",         label: "Dispatched",         variant: "normal"  },
  { value: "out_for_delivery",   label: "Out for Delivery",   variant: "normal"  },
  { value: "delivered",          label: "Delivered",          variant: "normal"  },
  { value: "delivery_exception", label: "Delivery Exception", variant: "danger"  },
  { value: "returned",           label: "Returned",           variant: "danger"  },
] as const

export default function AdminOrdersPage() {
  const { status } = useSession()
  const [orders, setOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  async function loadOrders() {
    const token = await getAccessToken()
    if (!token) return
    try {
      const res = await getAdminOrders(token, 0, 200)
      setOrders(res.content)
    } catch {
      toast.error("Failed to load orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status !== "authenticated") { if (status === "unauthenticated") setLoading(false); return }
    loadOrders()
  }, [status])

  const flatOrders = useMemo<FlatOrder[]>(() =>
    orders.map((order) => {
      const itemsCount = order.subOrders.reduce((sum, so) => sum + so.items.reduce((s, i) => s + i.quantity, 0), 0)
      const statuses = order.subOrders.map((so) => so.fulfillmentStatus)
      const fulfillment = statuses.length > 0 ? statuses[0] : order.status
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentStatus: fulfillment,
        itemsCount,
        totalCents: order.totalCents,
        currency: order.currency,
        placedAt: order.placedAt || order.createdAt,
        raw: order,
      }
    }),
    [orders],
  )

  const columns = useMemo(() => [
    col.accessor("orderNumber", {
      header: "Order",
      cell: (info) => <span className="font-mono text-sm font-medium text-gray-900">{info.getValue()}</span>,
    }),
    col.accessor("placedAt", {
      header: "Date",
      cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span>,
    }),
    col.accessor("status", {
      header: "Order Status",
      cell: (info) => {
        const b = statusBadge(info.getValue())
        return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>
      },
    }),
    col.accessor("fulfillmentStatus", {
      header: "Fulfillment",
      cell: (info) => {
        const b = statusBadge(info.getValue())
        return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${b.className}`}>{info.getValue().replace(/_/g, " ")}</span>
      },
    }),
    col.accessor("itemsCount", {
      header: "Items",
      cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
    }),
    col.accessor("totalCents", {
      header: "Total",
      cell: (info) => <span className="font-medium text-gray-900">{formatCents(info.getValue(), info.row.original.currency)}</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const row = info.row.original
        const actions: RowAction[] = [
          { label: "View Details", icon: <Eye />, onClick: () => setSelectedOrderId(row.id) },
          { label: "Manage Fulfillment", icon: <ClipboardList />, onClick: () => setSelectedOrderId(row.id) },
        ]
        return <RowActions actions={actions} />
      },
      enableSorting: false,
    }),
  ], [])

  const selectedOrder = useMemo(
    () => flatOrders.find((o) => o.id === selectedOrderId) ?? null,
    [flatOrders, selectedOrderId],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
        <p className="mt-1 text-sm text-gray-500">Manage all orders, update fulfillment status, and handle exceptions</p>
      </div>

      <DataTable
        columns={columns}
        data={flatOrders}
        loading={loading}
        searchPlaceholder="Search orders…"
        searchColumn="orderNumber"
        enableExport
        exportFilename="admin-orders"
        emptyMessage="No orders in the system yet."
      />

      <AdminOrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={loadOrders}
      />
    </div>
  )
}

function AdminOrderDetailSheet({
  order,
  onClose,
  onUpdated,
}: {
  order: FlatOrder | null
  onClose: () => void
  onUpdated: () => Promise<void>
}) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [trackingInput, setTrackingInput] = useState("")

  async function handleUpdateStatus(subOrderId: string, newStatus: string) {
    setUpdating(subOrderId + newStatus)
    try {
      const token = await getAccessToken()
      if (!token) return
      await updateSubOrderStatus(token, subOrderId, newStatus, trackingInput || undefined)
      toast.success(`Fulfillment updated to ${newStatus.replace(/_/g, " ")}`)
      await onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setUpdating(null)
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
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Order Status</p>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(order.status).className}`}>
                  {statusBadge(order.status).label}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Placed</p>
                <p className="mt-1 text-sm text-gray-600">{formatDate(order.placedAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Payment</p>
                <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
                   <CreditCard className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                   <p className="text-sm text-gray-900 truncate">
                     {order.raw.paymentMethod || "Stripe"}
                     {order.raw.last4 ? ` •••• ${order.raw.last4}` : ""}
                   </p>
                </div>
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

            {order.raw.subOrders.map((sub) => (
              <div key={sub.id} className="rounded-xl border border-gray-200 p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-gray-900">Store {sub.storeId.slice(0, 8)}…</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(sub.fulfillmentStatus).className}`}>
                      {sub.fulfillmentStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">{formatCents(subOrderCustomerTotal(sub), order.currency)}</span>
                    {(sub.discountCents ?? 0) > 0 && (
                      <p className="text-[11px] text-green-600">
                        includes −{formatCents(sub.discountCents ?? 0, order.currency)}
                      </p>
                    )}
                  </div>
                </div>

                {sub.trackingNumber && (
                  <p className="text-xs text-gray-500">Tracking: <span className="text-gray-900 font-mono">{sub.trackingNumber}</span></p>
                )}

                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Product</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sub.items.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {item.imageUrl && <img src={item.imageUrl} alt="" className="h-7 w-7 rounded object-cover border border-gray-200" />}
                              <span className="text-gray-600">{item.productTitle || "Product"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{formatCents(item.unitPriceCents * item.quantity, order.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Seller-managed steps — read-only for admin */}
                {(sub.fulfillmentStatus === "pending" || sub.fulfillmentStatus === "processing" || sub.fulfillmentStatus === "packaged") && (
                  <div className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
                    <Package className="h-3.5 w-3.5 shrink-0 text-indigo-400 mt-0.5" />
                    <p className="text-xs text-indigo-700">
                      <span className="font-semibold">Seller is preparing this order.</span>{" "}
                      Processing and packaging steps are managed by the seller. Fulfillment buttons will appear once the seller dispatches.
                    </p>
                  </div>
                )}

                {/* Admin delivery controls */}
                {sub.fulfillmentStatus !== "delivered" && sub.fulfillmentStatus !== "returned" &&
                  sub.fulfillmentStatus !== "pending" && sub.fulfillmentStatus !== "processing" && sub.fulfillmentStatus !== "packaged" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery Controls</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ADMIN_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          disabled={!!updating || s.value === sub.fulfillmentStatus}
                          onClick={() => handleUpdateStatus(sub.id, s.value)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40
                            ${s.value === sub.fulfillmentStatus
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : s.variant === "danger"
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
                        >
                          {updating === sub.id + s.value ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      placeholder="Tracking / reference number (optional)"
                      className="h-8 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs text-gray-900 placeholder:text-gray-500 focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </SheetBody>
    </Sheet>
  )
}
