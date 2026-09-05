/**
 * Shared order-status helpers — grouping + badge rendering used by both the
 * standalone `/orders` page and the account-hub `OrdersSection`. Extracted
 * so the two surfaces never drift on what counts as "Shipped" vs
 * "Delivered" etc.
 */

import { Package, Clock, CheckCircle, Truck, XCircle, type LucideIcon } from "lucide-react"

export type StatusGroup = "all" | "placed" | "shipped" | "out_for_delivery" | "delivered"

export const STATUS_GROUPS: Record<Exclude<StatusGroup, "all">, ReadonlySet<string>> = {
  placed:           new Set(["pending", "awaiting_payment", "paid", "confirmed", "processing", "packaged"]),
  shipped:          new Set(["dispatched", "shipped"]),
  out_for_delivery: new Set(["out_for_delivery"]),
  delivered:        new Set(["delivered", "completed"]),
}

export function classifyStatus(status: string): Exclude<StatusGroup, "all"> | null {
  const s = status.toLowerCase()
  for (const [group, members] of Object.entries(STATUS_GROUPS)) {
    if (members.has(s)) return group as Exclude<StatusGroup, "all">
  }
  return null
}

export interface StatusBadge {
  label: string
  Icon: LucideIcon
  tone: string
}

/**
 * Status pill — surfaces the actual order status name, not a marketing
 * synonym. Tone is grouped (Pending = gray/amber, Confirmed = blue,
 * Shipped = gold, Delivered = green, Cancelled = red).
 */
export function statusBadge(status: string): StatusBadge {
  const s = status.toLowerCase()
  // Cancelled / refunded show the raw label so buyers see exactly why the
  // order is in that state.
  if (s === "cancelled") {
    return { label: "Cancelled", Icon: XCircle, tone: "bg-red-50 text-red-700 border-red-200" }
  }
  if (s === "refunded") {
    return { label: "Refunded", Icon: XCircle, tone: "bg-red-50 text-red-700 border-red-200" }
  }
  if (s === "payment_failed") {
    return { label: "Payment failed", Icon: XCircle, tone: "bg-red-50 text-red-700 border-red-200" }
  }
  if (STATUS_GROUPS.placed.has(s)) {
    return { label: "Order Placed", Icon: Package, tone: "bg-amber-50 text-amber-800 border-amber-200" }
  }
  if (STATUS_GROUPS.shipped.has(s)) {
    return { label: "Shipped", Icon: Truck, tone: "bg-blue-50 text-blue-700 border-blue-200" }
  }
  if (STATUS_GROUPS.out_for_delivery.has(s)) {
    return { label: "Out for Delivery", Icon: Truck, tone: "bg-brand-gold/15 text-brand-gold-foreground border-brand-gold/30" }
  }
  if (STATUS_GROUPS.delivered.has(s)) {
    return { label: "Delivered", Icon: CheckCircle, tone: "bg-green-50 text-green-700 border-green-200" }
  }
  return { label: status, Icon: Clock, tone: "bg-gray-100 text-foreground border-gray-200" }
}
