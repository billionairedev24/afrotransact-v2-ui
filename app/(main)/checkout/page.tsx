/**
 * Server-rendered checkout page.
 *
 * The previous implementation was a client component that fetched the buyer's
 * profile + saved addresses in a post-mount useEffect — producing a visible
 * skeleton while two round-trips resolved. Now we:
 *
 *   1. Read the NextAuth session server-side via getServerSession.
 *   2. If the user is authenticated, fetch profile + addresses in parallel
 *      using the access token, all on the server.
 *   3. Pass the result as `initialContext` to the client component, which
 *      seeds its state synchronously on first render — no skeleton, no
 *      client-side fetch in the common path.
 *
 * Unauthenticated users, or cases where the upstream fetch fails, get
 * `initialContext={null}` and the client falls back to its original
 * useEffect path.
 *
 * `export const dynamic = "force-dynamic"` is important: the session cookie
 * is request-specific, and without this marker Next.js may try to statically
 * prerender this route and drop the `cookies()` access, yielding an empty
 * session for every visitor.
 */

import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  loadCheckoutShippingContext,
  resolveServiceZone,
  type CheckoutShippingContext,
} from "@/lib/api"
import CheckoutClientV2 from "./CheckoutClientV2"
import { RegionBlock } from "@/components/geo/RegionBlock"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
  /** Server-side guard: avoids loading checkout when commerce kill-switches are off (client still banners).
   *  Pass 3 of regions→service_zones migration: this gate now goes through
   *  the public Service Zone resolver. SSR has no buyer location (it lives
   *  in a localStorage-backed Zustand store), so we do a best-effort resolve
   *  using the default country. The client (CheckoutClientV2) re-evaluates
   *  with the real resolved zone once mounted.
   *
   *  paymentMethods are NOT seeded here; per-zone payment methods are not
   *  yet wired in config-service and joining via regions_legacy_id would
   *  require a backend change outside this pass's scope. The client picks
   *  up payment methods independently after mount. */
  try {
    const resolved = await resolveServiceZone("US")
    const feats = resolved?.effectiveFeatures ?? {}
    if (feats.marketplace_enabled === false || feats.stripe === false) {
      redirect("/cart?notice=checkout_unavailable")
    }
  } catch {
    // Upstream unreachable — CheckoutClient banners + order-service gates still defend.
  }

  const session = await getServerSession(authOptions)
  const token = (session as { accessToken?: string } | null)?.accessToken

  let initialContext: CheckoutShippingContext | null = null
  if (token) {
    try {
      initialContext = await loadCheckoutShippingContext(token)
    } catch {
      // Upstream hiccup — let the client do its own fetch rather than
      // blocking or erroring the page. This preserves the legacy behavior
      // as a graceful fallback.
      initialContext = null
    }
  }

  // V2 single-page checkout is the only checkout: no order is created until the
  // buyer pays (materialized on the payment.succeeded webhook).
  return (
    <RegionBlock>
      <CheckoutClientV2 initialContext={initialContext} />
    </RegionBlock>
  )
}
