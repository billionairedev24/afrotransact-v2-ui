import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAnalyticsAvailability,
  getAdminAnalyticsSettings,
  putAdminAnalyticsSettings,
  type AnalyticsAvailability,
} from "@/lib/api"

const publicKey = ["config", "analytics"] as const
const adminKey = ["admin", "config", "analytics"] as const

/** Cached public read for sidebars and analytics gating. */
export function useAnalyticsAvailability() {
  return useQuery({
    queryKey: publicKey,
    queryFn: getAnalyticsAvailability,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * While loading, treat analytics as enabled so sidebars do not flicker.
 * After load, respect the server value.
 */
export function useAdminAnalyticsNavVisible(): boolean {
  const { data, isLoading } = useAnalyticsAvailability()
  if (isLoading) return true
  return data?.adminAnalyticsEnabled !== false
}

export function useSellerAnalyticsNavVisible(): boolean {
  const { data, isLoading } = useAnalyticsAvailability()
  if (isLoading) return true
  return data?.sellerAnalyticsEnabled !== false
}

export function useAdminAnalyticsSettings(token: string | undefined) {
  return useQuery({
    queryKey: adminKey,
    queryFn: () => getAdminAnalyticsSettings(token!),
    enabled: !!token,
    staleTime: 30 * 1000,
  })
}

export function useInvalidateAnalyticsSettings() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: publicKey })
    qc.invalidateQueries({ queryKey: adminKey })
  }
}

export type { AnalyticsAvailability }
export { putAdminAnalyticsSettings }
