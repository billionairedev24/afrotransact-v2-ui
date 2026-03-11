"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { getAccessToken } from "@/lib/auth-helpers"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

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

export function PostLoginRedirect({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const checkedRef = useRef(false)

  const doCheck = useCallback(async () => {
    if (!session?.user?.id || checkedRef.current) return
    checkedRef.current = true

    const isOnOnboarding = pathname?.startsWith("/dashboard/onboarding")
    const isOnAuthPage = pathname?.startsWith("/auth/")
    const isOnApiPage = pathname?.startsWith("/api/")
    const isOnAdmin = pathname?.startsWith("/admin")

    if (isOnAuthPage || isOnApiPage || isOnOnboarding || isOnAdmin) return

    const token = await getAccessToken()
    if (!token) return

    const role = await fetchUserRole(token)
    if (!role || role === "buyer") return

    if (role === "admin") return

    // Only sellers get routed to dashboard/onboarding
    if (role === "seller") {
      const obStatus = await fetchOnboardingStatus(token)
      const isOnDashboard = pathname?.startsWith("/dashboard")

      if (obStatus === "approved" || obStatus === "completed") {
        if (!isOnDashboard) router.replace("/dashboard")
      } else if (obStatus !== null) {
        router.replace("/dashboard/onboarding")
      }
    }
  }, [session, pathname, router])

  useEffect(() => {
    if (status === "authenticated") {
      doCheck()
    }
  }, [status, doCheck])

  return <>{children}</>
}
