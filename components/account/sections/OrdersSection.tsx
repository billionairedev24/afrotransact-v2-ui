"use client"

/**
 * OrdersSection — Orders list embedded in the one-page account hub.
 *
 * The actual list UI (filter pills, order cards, pagination) lives in the
 * shared `components/orders/OrdersList.tsx`, also rendered by the standalone
 * `/orders` page so the two surfaces never drift. This wrapper exists purely
 * as the hub's mount point / seam for hub-specific chrome, should any be
 * needed later.
 */

import { OrdersList } from "@/components/orders/OrdersList"

export function OrdersSection() {
  return <OrdersList pageSize={6} />
}
