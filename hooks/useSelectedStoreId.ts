"use client"

import { useQuery } from "@tanstack/react-query"

import { getAccessToken } from "@/lib/auth-helpers"
import { getCurrentSeller, getSellerStores } from "@/lib/api"
import { pickPrimarySellerStoreId } from "@/lib/seller-store"
import { useActiveStore } from "@/stores/active-store"

/**
 * Returns the storeId every seller dashboard surface should scope by.
 *
 * Resolution order:
 *  1. Persisted selection from the StoreSwitcher (zustand + localStorage).
 *  2. Fall back to the seller's primary store (oldest active) when the
 *     persisted selection is null or stale.
 *
 * Uses TanStack to dedupe the seller + stores fetches across pages.
 */
export function useSelectedStoreId() {
  const activeStoreId = useActiveStore((s) => s.activeStoreId)

  const sellerQuery = useQuery({
    queryKey: ["selected-store-current-seller"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getCurrentSeller(token)
    },
    staleTime: 10 * 60 * 1000,
  })

  const storesQuery = useQuery({
    queryKey: ["selected-store-stores", sellerQuery.data?.id],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getSellerStores(token, sellerQuery.data!.id)
    },
    enabled: !!sellerQuery.data?.id,
    staleTime: 60 * 1000,
  })

  // Prefer the explicitly-selected store, but only if it still exists.
  let storeId: string | null = null
  if (storesQuery.data?.length) {
    if (activeStoreId && storesQuery.data.some((s) => s.id === activeStoreId)) {
      storeId = activeStoreId
    } else {
      storeId = pickPrimarySellerStoreId(storesQuery.data)
    }
  }

  return {
    storeId,
    isLoading: sellerQuery.isLoading || storesQuery.isLoading,
    isError: sellerQuery.isError || storesQuery.isError,
    stores: storesQuery.data ?? [],
  }
}
