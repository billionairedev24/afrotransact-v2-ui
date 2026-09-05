/**
 * Checkout confirmation route.
 *
 * This file is a SERVER component on purpose: the whole confirmation UI is
 * client-side (polling, cart clearing), but if the route's page.tsx is itself
 * a `"use client"` module, the Next.js standalone build fails to emit the
 * route's client-reference manifest and SSR crashes with
 *   InvariantError: The client reference manifest for route
 *   "/checkout/complete" does not exist.
 * Wrapping the client component in a server-component route gives the route a
 * proper server/client boundary and the manifest is emitted correctly.
 */
import CheckoutCompleteClient from "./CheckoutCompleteClient"

export default function CheckoutCompletePage() {
  return <CheckoutCompleteClient />
}
