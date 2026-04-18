import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getPortalAnalyticsAvailability,
  getAdminAnalyticsSettings,
  putAdminAnalyticsSettings,
  type AnalyticsAvailability,
} from "@/lib/api"

const portalKey = ["config", "analytics", "portal"] as const
const adminKey = ["admin", "config", "analytics"] as const

/** Cached read for admin/seller sidebars — requires session (seller or admin role). */
export function useAnalyticsAvailability() {
  const { status } = useSession()
  return useQuery({
    queryKey: portalKey,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getPortalAnalyticsAvailability(token)
    },
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * While loading, treat analytics as enabled so sidebars do not flicker.
 * After load, respect the server value.
 */
export function useAdminAnalyticsNavVisible(): boolean {
  const { status } = useSession()
  const { data, isLoading, isError } = useAnalyticsAvailability()
  if (status !== "authenticated") return false
  if (isLoading) return true
  if (isError) return false
  return data?.adminAnalyticsEnabled !== false
}

export function useSellerAnalyticsNavVisible(): boolean {
  const { status } = useSession()
  const { data, isLoading, isError } = useAnalyticsAvailability()
  if (status !== "authenticated") return false
  if (isLoading) return true
  if (isError) return false
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
    qc.invalidateQueries({ queryKey: portalKey })
    qc.invalidateQueries({ queryKey: adminKey })
  }
}

export type { AnalyticsAvailability }
export { putAdminAnalyticsSettings }
