"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { getAccessToken } from "@/lib/auth-helpers"
import { isSellerDashboardOnboardingReady } from "@/lib/seller-dashboard-access"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

/**
 * Pages where a signed-in seller is allowed to stay — the post-login redirect
 * must NOT bounce them off these. Kept in one place so the render-time block
 * below and the async check use the exact same rule (otherwise a seller could
 * be shown the blocking spinner on a page the check then declines to redirect,
 * hanging forever).
 */
function isRedirectExemptPath(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard/onboarding") ||
    pathname.startsWith("/admin") ||
    // Public storefront surfaces sellers must be able to visit (e.g. preview
    // their own storefront from the dashboard).
    pathname.startsWith("/store/") ||
    pathname.startsWith("/stores") ||
    pathname.startsWith("/product/") ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/help") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/sell") ||
    pathname.startsWith("/o/")
  )
}

async function fetchUserRole(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      return (data.role ?? "buyer").toLowerCase()
    }
    return null
  } catch {
    return null
  }
}

async function fetchOnboardingStatus(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/seller/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      return (data.onboardingStatus ?? "").toLowerCase()
    }
    return null
  } catch {
    return null
  }
}

function RedirectingSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Taking you to your seller dashboard…</p>
    </div>
  )
}

export function PostLoginRedirect({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const checkedRef = useRef(false)
  // Once the async check decides NOT to redirect, unblock rendering. Guards
  // against hanging the spinner in the edge case where seller/me is
  // unreachable (obStatus null) so no redirect fires.
  const [checkSettled, setCheckSettled] = useState(false)

  // Seller identity is known SYNCHRONOUSLY from the JWT (realm role or the
  // registration_role attribute set at "Start Selling"). We use it to block
  // the home render immediately — before the /users/me + /seller/me round trip
  // — so a seller never sees the storefront landing page flash past on the way
  // to their dashboard. Buyers/admins are never blocked.
  const roles = (session?.user?.roles as string[] | undefined) ?? []
  const registrationRole = (session?.user?.registrationRole ?? "").toLowerCase()
  const isSeller =
    roles.includes("seller") || registrationRole === "seller"
  const isAdmin =
    roles.includes("admin") || roles.includes("realm-admin") || roles.some((r) => r.includes("admin"))

  const doCheck = useCallback(async () => {
    if (!session?.user?.id || checkedRef.current) return
    checkedRef.current = true

    if (isRedirectExemptPath(pathname) || isAdmin) {
      setCheckSettled(true)
      return
    }

    const token = await getAccessToken()
    if (!token) { setCheckSettled(true); return }

    const role = await fetchUserRole(token)
    if (!role || role === "buyer") { setCheckSettled(true); return }

    // Only sellers get routed to dashboard/onboarding
    if (role === "seller") {
      const obStatus = await fetchOnboardingStatus(token)
      const isOnDashboard = pathname?.startsWith("/dashboard")

      if (obStatus !== null && isSellerDashboardOnboardingReady(obStatus)) {
        if (!isOnDashboard) { router.replace("/dashboard"); return }
        setCheckSettled(true)
      } else if (obStatus !== null) {
        router.replace("/dashboard/onboarding")
      } else {
        // seller/me unreachable — don't hang the spinner; render through.
        setCheckSettled(true)
      }
      return
    }
    setCheckSettled(true)
  }, [session, pathname, router, isAdmin])

  useEffect(() => {
    if (status === "authenticated") {
      doCheck()
    }
  }, [status, doCheck])

  // Block the storefront render for a known seller who is about to be
  // redirected off this page — show the spinner instead of letting the home
  // page paint and then yanking it away.
  const shouldBlock =
    status === "authenticated" &&
    isSeller &&
    !isAdmin &&
    !isRedirectExemptPath(pathname) &&
    !checkSettled

  if (shouldBlock) return <RedirectingSpinner />

  return <>{children}</>
}
