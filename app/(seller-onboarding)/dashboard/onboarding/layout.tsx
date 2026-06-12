import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  isSellerSuspended,
  parseSellerMeResponse,
} from "@/lib/seller-dashboard-access"
import { OnboardingHeader } from "./OnboardingHeader"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/dashboard/onboarding")
  }

  // If the seller has been suspended by an admin, never render the
  // onboarding wizard — that's the UX bug where a suspended seller
  // logs in and feels like they're being asked to register again.
  // Mirrors the same check in app/(seller)/layout.tsx.
  const token = (session as { accessToken?: string }).accessToken
  if (token) {
    try {
      const h = await headers()
      const cookie = h.get("cookie") ?? ""
      const apiBase =
        process.env.SELLER_API_INTERNAL_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        "http://localhost:8080"
      const res = await fetch(`${apiBase}/api/v1/seller/me`, {
        headers: { Authorization: `Bearer ${token}`, cookie },
        cache: "no-store",
      })
      const seller = await parseSellerMeResponse(res)
      const status =
        typeof seller?.onboardingStatus === "string"
          ? seller.onboardingStatus
          : typeof seller?.status === "string"
            ? seller.status
            : ""
      if (isSellerSuspended(status)) {
        redirect("/dashboard/suspended")
      }
    } catch (err) {
      // Preserve next/navigation redirects.
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        typeof (err as { digest?: unknown }).digest === "string" &&
        (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        throw err
      }
      // Otherwise, fall through and render the onboarding wizard rather than
      // hard-failing for everyone if seller/me is temporarily unreachable.
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingHeader userName={session.user?.name ?? session.user?.email ?? ""} />
      {children}
    </div>
  )
}
