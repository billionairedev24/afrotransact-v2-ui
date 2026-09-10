import type { OrderDto } from "./api"

/**
 * Turning orders into rows an analyst can actually work with.
 *
 * The admin orders export used to emit one row per order with an item COUNT, so
 * the most obvious question — "how many of product X have we sold?" — could not
 * be answered from the file at all. These functions produce a line-item grain
 * instead, which makes that a plain pivot or SUMIF.
 */

export interface OrderLineItemRow {
  orderNumber: string
  placedAt: string
  orderStatus: string
  fulfillmentStatus: string
  product: string
  variant: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
  currency: string
}

export interface ProductTotal {
  product: string
  quantity: number
  revenueCents: number
  /** Distinct orders containing this product — demand breadth, not line count. */
  orders: number
}

/**
 * One row per purchased line item, with the order's context repeated on each so
 * every row stands alone in a pivot table. Spans sub-orders, so a mixed
 * house/seller order contributes all of its items rather than just the first
 * group's.
 */
export function flattenOrderLineItems(orders: OrderDto[]): OrderLineItemRow[] {
  const rows: OrderLineItemRow[] = []
  for (const order of orders) {
    for (const sub of order.subOrders ?? []) {
      for (const item of sub.items ?? []) {
        rows.push({
          orderNumber: order.orderNumber,
          placedAt: order.placedAt || order.createdAt,
          orderStatus: order.status,
          fulfillmentStatus: sub.fulfillmentStatus,
          // A blank product cell would silently corrupt any pivot built on it,
          // so fall back through variant name to an explicit placeholder.
          product: item.productTitle?.trim() || item.variantName?.trim() || "(unnamed product)",
          variant: item.variantName?.trim() || "",
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.totalPriceCents,
          currency: order.currency,
        })
      }
    }
  }
  return rows
}

/**
 * Per-product totals, best sellers first — the series the chart is drawn from,
 * and the sheet to pivot on if you want your own cut.
 */
export function aggregateProductTotals(rows: OrderLineItemRow[]): ProductTotal[] {
  const byProduct = new Map<string, { quantity: number; revenueCents: number; orders: Set<string> }>()
  for (const row of rows) {
    let entry = byProduct.get(row.product)
    if (!entry) {
      entry = { quantity: 0, revenueCents: 0, orders: new Set() }
      byProduct.set(row.product, entry)
    }
    entry.quantity += row.quantity
    entry.revenueCents += row.lineTotalCents
    // A Set, so an order listing the same product twice counts once —
    // double-counting here would overstate how many customers wanted it.
    entry.orders.add(row.orderNumber)
  }
  return [...byProduct.entries()]
    .map(([product, v]) => ({
      product,
      quantity: v.quantity,
      revenueCents: v.revenueCents,
      orders: v.orders.size,
    }))
    .sort((a, b) => b.quantity - a.quantity || a.product.localeCompare(b.product))
}
