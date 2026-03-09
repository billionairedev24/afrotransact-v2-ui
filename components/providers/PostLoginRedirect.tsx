"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"

/**
 * Immediately redirects sellers to /dashboard after login using session
 * JWT data — no API calls needed. The seller layout handles the
 * approved vs onboarding distinction server-side.
 */
export function PostLoginRedirect({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || checkedRef.current) return
    checkedRef.current = true

    const isOnDashboard = pathname?.startsWith("/dashboard")
    const isOnAuthPage = pathname?.startsWith("/auth/")
    const isOnApiPage = pathname?.startsWith("/api/")
    const isOnAdmin = pathname?.startsWith("/admin")

    if (isOnAuthPage || isOnApiPage || isOnDashboard || isOnAdmin) return

    const roles = session.user.roles ?? []
    const isAdmin = roles.includes("admin") || roles.includes("realm-admin")
    if (isAdmin) return

    const registrationRole = (session.user.registrationRole ?? "").toLowerCase()
    const isSeller = registrationRole === "seller" || roles.includes("seller")

    if (isSeller) {
      router.replace("/dashboard")
    }
  }, [status, session, pathname, router])

  return <>{children}</>
}
