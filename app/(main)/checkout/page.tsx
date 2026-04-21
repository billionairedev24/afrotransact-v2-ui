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

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  loadCheckoutShippingContext,
  type CheckoutShippingContext,
} from "@/lib/api"
import CheckoutClient from "./CheckoutClient"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
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

  return <CheckoutClient initialContext={initialContext} />
}
