"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { getAccessToken } from "@/lib/auth-helpers"

interface UserProfileResponse {
  id: string
  role?: string
}

async function fetchUserProfile(token: string): Promise<UserProfileResponse | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return await res.json()
    return null
  } catch {
    return null
  }
}

async function fetchOnboardingStatus(token: string): Promise<string | null> {
  try {
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

    const isOnDashboard = pathname?.startsWith("/dashboard")
    const isOnOnboarding = pathname?.startsWith("/dashboard/onboarding")
    const isOnAuthPage = pathname?.startsWith("/auth/")
    const isOnApiPage = pathname?.startsWith("/api/")
    const isOnAdmin = pathname?.startsWith("/admin")

    if (isOnAuthPage || isOnApiPage || isOnOnboarding || isOnAdmin) return

    const roles = session.user.roles ?? []
    const isAdmin = roles.includes("admin") || roles.includes("realm-admin")
    if (isAdmin) return

    const token = await getAccessToken()
    if (!token) return

    // User profile role is the source of truth — set by the Keycloak
    // event-listener SPI webhook on registration.
    const profile = await fetchUserProfile(token)
    if (!profile) return

    const profileRole = (profile.role ?? "buyer").toLowerCase()

    if (profileRole !== "seller" && !roles.includes("seller")) return

    const obStatus = await fetchOnboardingStatus(token)
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
