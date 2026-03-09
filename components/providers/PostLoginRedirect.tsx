"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { getAccessToken } from "@/lib/auth-helpers"

const INTENT_KEY = "afro_register_intent"
const COOKIE_NAME = "afro_seller_intent"

function hasSellerCookie(): boolean {
  try {
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_NAME}=`))
  } catch {
    return false
  }
}

function clearSellerCookie() {
  try {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
  } catch { /* */ }
}

async function persistSellerIntentToKeycloak(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/set-seller-intent", { method: "POST" })
    return res.ok
  } catch {
    return false
  }
}

async function fetchOnboardingStatus(): Promise<string | null> {
  try {
    const token = await getAccessToken()
    if (!token) return null
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
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

export function PostLoginRedirect({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const checkedRef = useRef(false)

  const doCheck = useCallback(async () => {
    if (!session?.user?.id || checkedRef.current) return
    checkedRef.current = true

    const profileKey = `afro_profile_ok_${session.user.id}`
    if (!sessionStorage.getItem(profileKey)) {
      try {
        const token = await getAccessToken()
        if (token) {
          const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
          await fetch(`${API_BASE}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          sessionStorage.setItem(profileKey, "1")
        }
      } catch { /* best-effort */ }
    }

    const roles = session.user.roles ?? []
    const regRole = session.user.registrationRole
    const hasSeller = roles.includes("seller")
    const isAdmin = roles.includes("admin") || roles.includes("realm-admin")
    const isOnDashboard = pathname?.startsWith("/dashboard")
    const isOnOnboarding = pathname?.startsWith("/dashboard/onboarding")
    const isOnAuthPage = pathname?.startsWith("/auth/")
    const isOnApiPage = pathname?.startsWith("/api/")
    const isOnAdmin = pathname?.startsWith("/admin")

    if (isOnAuthPage || isOnApiPage || isOnOnboarding || isOnAdmin) return
    if (isAdmin) return

    let localIntent = false
    try {
      const raw = localStorage.getItem(INTENT_KEY)
      if (raw) {
        const intent = JSON.parse(raw) as { role?: string }
        if (intent.role === "seller") localIntent = true
        localStorage.removeItem(INTENT_KEY)
      }
    } catch {
      try { localStorage.removeItem(INTENT_KEY) } catch { /* */ }
    }

    const cookieIntent = hasSellerCookie()

    if (cookieIntent && regRole !== "seller") {
      await persistSellerIntentToKeycloak()
      clearSellerCookie()
    }

    const hasSellerIntent = hasSeller || regRole === "seller" || localIntent || cookieIntent

    if (!hasSellerIntent) return

    const obStatus = await fetchOnboardingStatus()
    if (obStatus === "approved") {
      if (!isOnDashboard) router.replace("/dashboard")
    } else if (obStatus !== null) {
      router.replace("/dashboard/onboarding")
    }
  }, [session, pathname, router])

  useEffect(() => {
    if (status === "authenticated") {
      doCheck()
    }
  }, [status, doCheck])

  return <>{children}</>
}
