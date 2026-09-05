"use client"

import { usePathname } from "next/navigation"

/**
 * Hides marketing chrome (the site footer + footer promo) on the checkout
 * payment step. Checkout is a focused, single-task flow with its own sticky
 * "Place your order" bar; the tall marketing footer bleeding in above that bar
 * — with a dead gap under the short order-summary card — reads as broken,
 * especially on mobile. The confirmation page (/checkout/complete) keeps the
 * footer: it's a post-order landing page where "continue shopping" belongs.
 */
export function HideOnCheckout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const onCheckout = pathname === "/checkout" || pathname === "/checkout/"
  if (onCheckout) return null
  return <>{children}</>
}
