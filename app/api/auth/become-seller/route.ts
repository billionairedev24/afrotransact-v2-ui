import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { grantSellerEntitlements } from "@/lib/keycloak-admin"

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const roles = session.user?.roles ?? []
  if (roles.includes("seller")) {
    return NextResponse.json({ ok: true, alreadySeller: true })
  }

  const { registrationOk, realmRoleOk } = await grantSellerEntitlements(userId)
  if (!realmRoleOk && !registrationOk) {
    return NextResponse.json(
      {
        error:
          "Could not update your account in Keycloak. For local dev: run Keycloak, set KEYCLOAK_ADMIN_USERNAME / KEYCLOAK_ADMIN_PASSWORD (master admin), ensure KEYCLOAK_ISSUER matches your realm, create a realm role named `seller`, and check the Next.js server log for [keycloak-admin] details.",
      },
      { status: 503 },
    )
  }

  return NextResponse.json({ ok: true, registrationOk, realmRoleOk })
}
