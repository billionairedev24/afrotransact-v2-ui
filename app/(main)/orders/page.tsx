/**
 * Customer Orders — standalone list page.
 *
 * Page chrome only ("Your orders" heading + subtitle); the actual list body
 * (filter pills, order cards, pagination) is the shared `OrdersList`
 * component also rendered inside the account hub's OrdersSection, so both
 * surfaces match the approved preview identically.
 *
 * Auth is gated by app/(main)/orders/layout.tsx server-side.
 */

import { OrdersList } from "@/components/orders/OrdersList"

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-[1040px] px-4 sm:px-6 lg:px-8 py-8 md:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Your orders</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Track deliveries, download receipts, buy again, or start a return.
      </p>
      <OrdersList pageSize={10} />
    </main>
  )
}
