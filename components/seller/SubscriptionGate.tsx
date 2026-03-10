"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getSubscription, getPublicPlans, type SubscriptionPlan } from "@/lib/api"
import { Loader2, ShieldCheck, Sparkles, Check } from "lucide-react"

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [checking, setChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])

  const isAdmin = session?.user?.roles?.includes("admin") || session?.user?.roles?.includes("realm-admin")
  const isOnboarding = pathname === "/dashboard/onboarding"

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setChecking(false)
      return
    }

    if (isAdmin || isOnboarding) {
      setHasAccess(true)
      setChecking(false)
      return
    }

    let cancelled = false

    async function check() {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return

        // First check if the seller's onboarding is complete.
        // If not, redirect to onboarding instead of showing subscription paywall.
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
        try {
          const sellerRes = await fetch(`${API_BASE}/api/v1/seller/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (sellerRes.ok) {
            const seller = await sellerRes.json()
            const obStatus = (seller.onboardingStatus ?? "").toLowerCase()
            if (obStatus && obStatus !== "approved") {
              if (!cancelled) router.replace("/dashboard/onboarding")
              return
            }
          }
        } catch { /* proceed to subscription check */ }

        const sub = await getSubscription(token)
        if (cancelled) return

        const activeStatuses = ["active", "trialing", "trial", "trial_extended", "past_due"]
        if (activeStatuses.includes(sub.status.toLowerCase())) {
          setHasAccess(true)
        } else {
          const publicPlans = await getPublicPlans()
          if (!cancelled) setPlans(publicPlans.filter((p) => p.active))
        }
      } catch {
        try {
          const publicPlans = await getPublicPlans()
          if (!cancelled) setPlans(publicPlans.filter((p) => p.active))
        } catch {
          // Plans fetch failed too — will show gate without plan cards
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [authStatus, isAdmin, isOnboarding, router])

  if (checking) {
    return (
      <div className="flex items-center justify-center py-32 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-gray-500">Checking subscription…</span>
      </div>
    )
  }

  if (hasAccess) return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <ShieldCheck className="h-10 w-10 text-primary" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Subscribe to Access Your Dashboard</h1>
      <p className="mt-3 max-w-md text-gray-500">
        You need an active subscription to manage products, view orders, and access seller tools.
        Pick a plan below to get started.
      </p>

      {plans.length > 0 && (
        <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
              </div>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatPrice(plan.priceCentsPerMonth)}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>

              {plan.description && (
                <p className="mt-2 text-xs text-gray-500">{plan.description}</p>
              )}

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-xs text-gray-600">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  Up to {plan.maxProducts} products
                </li>
                <li className="flex items-start gap-2 text-xs text-gray-600">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  Up to {plan.maxStores} store{plan.maxStores > 1 ? "s" : ""}
                </li>
              </ul>

              <Link
                href="/dashboard/subscription"
                className="mt-6 block rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-[#0f0f10] hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      )}

      {plans.length === 0 && (
        <Link
          href="/dashboard/subscription"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          View Subscription Plans
        </Link>
      )}
    </div>
  )
}
