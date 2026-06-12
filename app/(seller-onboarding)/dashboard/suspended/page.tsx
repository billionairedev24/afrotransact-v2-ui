import { redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { getServerSession } from "next-auth"
import { ShieldOff, Mail } from "lucide-react"
import { authOptions } from "@/lib/auth"
import {
  isSellerSuspended,
  parseSellerMeResponse,
} from "@/lib/seller-dashboard-access"

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@afrotransact.com"

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return null
  }
}

/**
 * Account-suspended landing for sellers. Reached by the (seller) layout
 * whenever onboardingStatus === "suspended" — keeps suspended sellers
 * out of the onboarding wizard (which previously made it feel like they
 * were being asked to register all over again).
 */
export default async function SuspendedSellerPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/auth/login?callbackUrl=/dashboard/suspended")
  }

  // Pull the seller record server-side so we can render the actual
  // suspension reason + date — same approach the seller layout uses.
  const h = await headers()
  const cookie = h.get("cookie") ?? ""
  const apiBase =
    process.env.SELLER_API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  const token = (session as { accessToken?: string }).accessToken

  let suspensionReason: string | null = null
  let suspendedAt: string | null = null

  if (token) {
    try {
      const res = await fetch(`${apiBase}/api/v1/seller/me`, {
        headers: { Authorization: `Bearer ${token}`, cookie },
        cache: "no-store",
      })
      const seller = await parseSellerMeResponse(res)
      // Only redirect AWAY when we have a confirmed non-suspended status.
      // A null seller / network failure must NOT bounce the page — that's
      // what was causing the "flash of suspended then back to onboarding"
      // (suspended page redirected to /dashboard, which re-evaluated and
      // sometimes resolved to /dashboard/onboarding before the layout
      // could re-redirect here).
      const statusRaw =
        typeof seller?.onboardingStatus === "string"
          ? seller.onboardingStatus
          : typeof seller?.status === "string"
            ? seller.status
            : null
      if (statusRaw && !isSellerSuspended(statusRaw)) {
        redirect("/dashboard")
      }
      suspensionReason =
        typeof seller?.suspensionReason === "string" ? seller.suspensionReason : null
      suspendedAt =
        typeof seller?.suspendedAt === "string" ? seller.suspendedAt : null
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
      // Network/parse failure — render generic copy and stay on this page.
    }
  }

  const formattedDate = fmtDate(suspendedAt)
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=Suspended%20seller%20account%20appeal`

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <ShieldOff className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Your seller account is suspended
            </h1>
            {formattedDate && (
              <p className="text-xs text-gray-500 mt-0.5">
                Suspended on {formattedDate}
              </p>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">
          You can&apos;t access the seller dashboard while your account is
          suspended. Existing orders are unaffected, but you can&apos;t list
          new products, edit your store, or receive new orders until an
          administrator reinstates your account.
        </p>

        {suspensionReason && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-1">
              Reason
            </p>
            <p className="text-sm text-red-900 whitespace-pre-line">
              {suspensionReason}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={mailto}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-gold-foreground shadow-sm hover:bg-brand-gold-hover transition-colors"
          >
            <Mail className="h-4 w-4" />
            Contact support
          </a>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to AfroTransact
          </Link>
        </div>

        <p className="mt-5 text-xs text-gray-500">
          Need a faster reply? Email{" "}
          <a
            href={mailto}
            className="underline hover:text-gray-700"
          >
            {SUPPORT_EMAIL}
          </a>
          {" "}with your business name and the reason above.
        </p>
      </div>
    </main>
  )
}
