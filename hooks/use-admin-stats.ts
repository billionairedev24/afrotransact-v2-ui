import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth-helpers";
import {
  getAdminProducts,
  getAdminSellers,
  getAdminSellerStats,
  getAdminRegions,
  getAdminPlans,
  getAdminReviews,
  getAdminSellerDetail,
  getAdminAnalytics,
  type Product,
  type SellerInfo
} from "@/lib/api";

/**
 * Returns the count of items in the work queue (pending products + submitted seller applications).
 */
export function useWorkQueueCounts() {
  return useQuery({
    queryKey: ["admin", "work-queue", "counts"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      
      const [products, sellers] = await Promise.all([
        getAdminProducts(token, "pending_review", 0, 1).catch(() => ({ totalElements: 0 })),
        getAdminSellers(token, undefined, 0, 1, "submitted").catch(() => ({ totalElements: 0 })),
      ]);
      
      return {
        products: products.totalElements,
        sellers: sellers.totalElements,
        total: products.totalElements + sellers.totalElements,
      };
    },
    // Keep data fresh but don't spam the API unnecessarily
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Returns full lists of pending items in the work queue.
 */
export function useWorkQueueLists() {
  return useQuery({
    queryKey: ["admin", "work-queue", "lists"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      
      const [products, sellers] = await Promise.all([
        getAdminProducts(token, "pending_review", 0, 100),
        getAdminSellers(token, undefined, 0, 100, "submitted"),
      ]);
      
      return {
        products: (products.content || []) as Product[],
        sellers: (sellers.content || []) as SellerInfo[],
      };
    },
  });
}

/**
 * Returns the main administrative dashboard statistics.
 */
export function useAdminOverviewStats() {
  return useQuery({
    queryKey: ["admin", "overview", "stats"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getAdminSellerStats(token);
    },
  });
}

/**
 * Returns the list of regions for the admin dashboard.
 */
export function useAdminRegions() {
  return useQuery({
    queryKey: ["admin", "regions"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getAdminRegions(token);
    },
  });
}

/**
 * Returns the list of subscription plans for the admin dashboard.
 */
export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getAdminPlans(token);
    },
  });
}

/**
 * Returns recent reviews for the platform health overview.
 */
export function useAdminRecentReviews() {
  return useQuery({
    queryKey: ["admin", "reviews", "recent"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getAdminReviews(token, 1, 1);
    },
  });
}

/**
 * Returns recent seller applications for the dashboard activity list.
 */
export function useAdminRecentSellers() {
  return useQuery({
    queryKey: ["admin", "sellers", "recent"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      const res = await getAdminSellers(token, undefined, 0, 5, "submitted");
      return res.content || [];
    },
  });
}

/**
 * Returns a paginated list of sellers for the seller management page.
 */
export function useAdminSellers(status?: string, page = 0, size = 15) {
  return useQuery({
    queryKey: ["admin", "sellers", "list", { status, page, size }],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getAdminSellers(token, undefined, page, size, status === "all" ? undefined : status);
    },
  });
}

/**
 * Returns full details for a specific seller.
 */
export function useAdminSellerDetail(sellerId: string | null) {
  return useQuery({
    queryKey: ["admin", "sellers", "detail", sellerId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      if (!sellerId) return null;
      return getAdminSellerDetail(token, sellerId);
    },
    enabled: !!sellerId,
  });
}

/**
 * Returns admin platform analytics (revenue, commissions, trends) for the given time range.
 */
export function useAdminAnalytics(days = 30) {
  return useQuery({
    queryKey: ["admin", "analytics", days],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      return getAdminAnalytics(token, days);
    },
    staleTime: 5 * 60 * 1000,
  });
}
