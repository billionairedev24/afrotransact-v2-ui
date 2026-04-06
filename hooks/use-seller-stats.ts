import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth-helpers";
import { getCurrentSeller, getSellerStores, getSellerAnalytics, type SellerInfo, type StoreDetail } from "@/lib/api";

/**
 * Returns the current seller's profile, including onboarding status.
 */
export function useSellerMe() {
  return useQuery({
    queryKey: ["seller", "me"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getCurrentSeller(token);
    },
    // Use stale-while-revalidate for faster dashboard load
    staleTime: 60 * 1000, 
  });
}

/**
 * Returns the stores associated with the current seller.
 */
export function useSellerStores(sellerId?: string) {
  return useQuery({
    queryKey: ["seller", "stores", sellerId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      if (!sellerId) return [];
      return getSellerStores(token, sellerId);
    },
    enabled: !!sellerId,
  });
}

/**
 * Returns seller analytics for the given store IDs and time range.
 */
export function useSellerAnalytics(storeIds: string[], days = 30) {
  return useQuery({
    queryKey: ["seller", "analytics", storeIds, days],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getSellerAnalytics(token, storeIds, days);
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
