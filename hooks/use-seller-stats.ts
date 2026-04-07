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
 * Returns seller analytics for the given store IDs and date range.
 * Both startDate and endDate must be ISO date strings (YYYY-MM-DD).
 */
export function useSellerAnalytics(storeIds: string[], startDate: string, endDate: string, enabled = true) {
  return useQuery({
    // v2: bust cached responses from earlier buggy backend deployments
    queryKey: ["seller", "analytics", "v2", storeIds, startDate, endDate],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getSellerAnalytics(token, storeIds, startDate, endDate);
    },
    enabled: enabled && storeIds.length > 0 && !!startDate && !!endDate,
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });
}
