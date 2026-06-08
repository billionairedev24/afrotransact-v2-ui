import { useQuery } from "@tanstack/react-query"
import { getPublicPlans, type SubscriptionPlan } from "@/lib/api"

/**
 * Fetch the public list of active subscription plans.
 *
 * The plans rarely change so we cache aggressively. All consumers (pricing
 * page, onboarding plan picker, seller dashboard plan switcher, public
 * marketing surfaces) should call this hook rather than hardcoding plan data.
 */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription-plans", "public"],
    queryFn: () => getPublicPlans(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
