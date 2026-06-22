"use client"

import { useQuery } from "@tanstack/react-query"

import { getAccessToken } from "@/lib/auth-helpers"
import { getSubscription } from "@/lib/api"

export type AnalyticsTier = "basic" | "medium" | "comprehensive"

const ORDER: AnalyticsTier[] = ["basic", "medium", "comprehensive"]

/**
 * Pulls the seller's plan analytics tier from their active subscription.
 * Defaults to 'basic' when there is no subscription (mid-onboarding, plan
 * just downgraded, etc.) — never blocks the page entirely.
 */
export function useSellerAnalyticsTier(): {
  tier: AnalyticsTier
  isLoading: boolean
  hasAtLeast: (min: AnalyticsTier) => boolean
} {
  const q = useQuery({
    queryKey: ["seller-analytics-tier"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      const sub = await getSubscription(token).catch(() => null)
      const raw = (sub?.plan?.analyticsTier as AnalyticsTier | undefined) ?? "basic"
      return ORDER.includes(raw) ? raw : "basic"
    },
    staleTime: 5 * 60 * 1000,
  })

  const tier: AnalyticsTier = q.data ?? "basic"
  return {
    tier,
    isLoading: q.isLoading,
    hasAtLeast: (min: AnalyticsTier) => ORDER.indexOf(tier) >= ORDER.indexOf(min),
  }
}
