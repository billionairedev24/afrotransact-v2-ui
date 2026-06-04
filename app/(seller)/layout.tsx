import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SellerShell } from "@/components/seller/SellerShell"
import type { SellerInfo } from "@/lib/api"
import {
  isSellerDashboardOnboardingReady,
  parseSellerMeResponse,
} from "@/lib/seller-dashboard-access"

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/dashboard")
  }

  const roles = session.user?.roles ?? []
  const registrationRole = (session.user?.registrationRole ?? "").toLowerCase()
  const isAdmin = roles.includes("admin") || roles.includes("realm-admin")

  const jwtSellerIntent =
    roles.includes("seller") || registrationRole === "seller"

  if (isAdmin) {
    return (
      <SellerShell
        userName={session.user?.name ?? undefined}
        userEmail={session.user?.email ?? undefined}
      >
        {children}
      </SellerShell>
    )
  }

  const apiBase =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"

  const token = session.accessToken
  if (!token) {
    redirect("/auth/login?callbackUrl=/dashboard")
  }

  const degradedShell = (
    <SellerShell
      userName={session.user?.name ?? undefined}
      userEmail={session.user?.email ?? undefined}
    >
      {children}
    </SellerShell>
  )

  try {
    const res = await fetch(`${apiBase}/api/v1/seller/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })

    if (res.status === 401 || res.status === 403) {
      redirect("/auth/login?callbackUrl=/dashboard")
    }

    const sellerRecord = await parseSellerMeResponse(res)

    if (!sellerRecord) {
      if (!res.ok) {
        if (jwtSellerIntent && res.status >= 500) {
          console.warn("[seller/layout] seller/me HTTP", res.status, "— degrading dashboard shell")
          return degradedShell
        }
        if (jwtSellerIntent) {
          redirect("/dashboard/onboarding")
        }
        redirect("/")
      }
      /* 204 No Content or empty JSON — treated as “no seller row yet” */
      if (jwtSellerIntent) {
        redirect("/dashboard/onboarding")
      }
      redirect("/")
    }

    const obStatusRaw =
      sellerRecord.onboardingStatus ?? sellerRecord.status ?? ""

    if (isSellerDashboardOnboardingReady(obStatusRaw)) {
      return (
        <SellerShell
          userName={session.user?.name ?? undefined}
          userEmail={session.user?.email ?? undefined}
          seller={sellerRecord as unknown as SellerInfo}
        >
          {children}
        </SellerShell>
      )
    }

    redirect("/dashboard/onboarding")
  } catch {
    /* Network failures: don’t strand approved sellers behind onboarding forever */
    if (jwtSellerIntent) {
      console.warn("[seller/layout] seller/me fetch failed — degrading dashboard shell")
      return degradedShell
    }
    redirect("/")
  }
}
