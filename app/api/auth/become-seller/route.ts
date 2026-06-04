import { NextResponse } from "next/server"

/**
 * Disabled: seller role is now granted only via the invite-only flow.
 * Admins create a Keycloak user via the backend; Keycloak emails the
 * invitee a magic password-setup link and assigns the `seller` role on
 * the JWT. Kept as a defensive 403 stub so any stale clients cannot
 * self-grant the seller role.
 */
export async function POST() {
  return NextResponse.json({ error: "invite_required" }, { status: 403 })
}
