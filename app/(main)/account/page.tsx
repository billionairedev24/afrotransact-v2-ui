/**
 * /account — consolidated settings page.
 *
 * Single tall scrolling page with every section inline (Amazon-style
 * "Your Account" page). The old tile grid that punched the buyer out
 * to a per-section subpage is gone. Sub-routes (/account/profile,
 * /account/security, etc.) still resolve as deep links — each is just
 * one of the sections shown here, wrapped in AccountShell — so old
 * bookmarks keep working.
 *
 * Anchor IDs on each section power both the in-page sticky nav and
 * deep-link redirects from /account/settings#section.
 *
 * Note: no "Open Seller Dashboard" button. Buyer settings stays in
 * the buyer-app surface; sellers reach /dashboard via the global nav.
 */

import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { AccountClient } from "@/components/account/AccountClient"

export const metadata = { title: "Your Account | AfroTransact" }

function getFirstName(name?: string | null): string {
  if (!name) return "there"
  return name.trim().split(/\s+/)[0] || "there"
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/auth/login?callbackUrl=/account")

  const firstName = getFirstName(session.user?.name)
  const email = session.user?.email ?? ""

  return <AccountClient firstName={firstName} email={email} />
}
