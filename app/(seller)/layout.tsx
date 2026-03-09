import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SellerShell } from "@/components/seller/SellerShell"

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/dashboard")
  }

  const isAdmin = session.user?.roles?.includes("admin") || session.user?.roles?.includes("realm-admin")

  // Admins bypass all seller checks
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

  // For everyone else on /dashboard: check if they're an approved seller.
  // If not, send them to onboarding. /dashboard is ONLY for approved sellers.
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

  try {
    const token = (session as { accessToken?: string }).accessToken
    if (token) {
      const res = await fetch(`${apiBase}/api/v1/seller/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (res.ok) {
        const seller = await res.json()
        const obStatus = (seller.onboardingStatus ?? "").toLowerCase()
        if (obStatus === "approved") {
          return (
            <SellerShell
              userName={session.user?.name ?? undefined}
              userEmail={session.user?.email ?? undefined}
            >
              {children}
            </SellerShell>
          )
        }
      }
    }
  } catch {
    // API unreachable — fall through to onboarding redirect as safe default
  }

  // If we reach here: no seller record, or seller not approved → onboarding
  redirect("/dashboard/onboarding")
}
