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
  getAdminCatalogAnalyticsSnapshot,
  getAdminNotificationAnalyticsSnapshot,
  getAdminPaymentAnalyticsSnapshot,
  getAdminReviewAnalyticsSnapshot,
  getAdminSellerAnalyticsSnapshot,
  type Product,
  type SellerInfo
} from "@/lib/api";

function looksLikeUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

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
 * Returns admin platform analytics (revenue, commissions, trends) for the given date range.
 * Both startDate and endDate must be ISO date strings (YYYY-MM-DD).
 */
export function useAdminAnalytics(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    // v2: bust cached responses from earlier buggy backend deployments
    queryKey: ["admin", "analytics", "v2", startDate, endDate],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      const [base, regions, seller, catalog, payment, review, notification] = await Promise.allSettled([
        getAdminAnalytics(token, startDate, endDate),
        getAdminRegions(token),
        getAdminSellerAnalyticsSnapshot(token),
        getAdminCatalogAnalyticsSnapshot(token),
        getAdminPaymentAnalyticsSnapshot(token),
        getAdminReviewAnalyticsSnapshot(token),
        getAdminNotificationAnalyticsSnapshot(token),
      ]);

      if (base.status !== "fulfilled") {
        throw base.reason instanceof Error ? base.reason : new Error("Failed to load admin analytics");
      }

      const warnings: string[] = [];
      const regionsData = regions.status === "fulfilled" ? regions.value : [];
      const sellerData = seller.status === "fulfilled" ? seller.value : null;
      const catalogData = catalog.status === "fulfilled" ? catalog.value : null;
      const paymentData = payment.status === "fulfilled" ? payment.value : null;
      const reviewData = review.status === "fulfilled" ? review.value : null;
      const notificationData = notification.status === "fulfilled" ? notification.value : null;
      if (!sellerData) warnings.push("seller");
      if (!catalogData) warnings.push("catalog");
      if (!paymentData) warnings.push("payment");
      if (!reviewData) warnings.push("review");
      if (!notificationData) warnings.push("notification");

      const warningLabels: Record<string, string> = {
        seller: "Seller service",
        catalog: "Product catalog",
        payment: "Payments",
        review: "Reviews",
        notification: "Notifications",
      }
      const platformHealthWarnings =
        warnings.length > 0 ? warnings.map((w) => warningLabels[w] ?? w) : []

      const regionNameById = new Map(regionsData.map((r) => [r.id, r.name]));
      const revenueByRegion = base.value.revenueByRegion.map((row) => {
        const currentName = row.regionName?.trim();
        const shouldReplaceName = !currentName || currentName === row.regionId || looksLikeUuid(currentName);
        const resolvedName = regionNameById.get(row.regionId);
        return {
          ...row,
          regionName: shouldReplaceName ? (resolvedName ?? row.regionName) : row.regionName,
        };
      });

      return {
        ...base.value,
        revenueByRegion,
        platformHealth: {
          totalSellers: sellerData?.totalSellers ?? 0,
          approvedSellers: sellerData?.approvedSellers ?? 0,
          pendingSellerApplications: sellerData?.pendingSellerApplications ?? 0,
          activeStores: sellerData?.activeStores ?? 0,
          totalProducts: catalogData?.totalProducts ?? 0,
          activeProducts: catalogData?.activeProducts ?? 0,
          draftProducts: catalogData?.draftProducts ?? 0,
          storesWithActiveCatalog: catalogData?.storesWithActiveCatalog ?? 0,
          successfulPayments: paymentData?.successfulPayments ?? 0,
          failedPayments: paymentData?.failedPayments ?? 0,
          pendingTransfers: paymentData?.pendingTransfers ?? 0,
          pendingTransferAmountCents: paymentData?.pendingTransferAmountCents ?? 0,
          paidTransferAmountCents: paymentData?.paidTransferAmountCents ?? 0,
          totalReviews: reviewData?.totalReviews ?? 0,
          avgRating: reviewData?.avgRating ?? 0,
          reviewsLast30Days: reviewData?.reviewsLast30Days ?? 0,
          totalRecipients: notificationData?.totalRecipients ?? 0,
          activeRecipients: notificationData?.activeRecipients ?? 0,
          templateCount: notificationData?.templateCount ?? 0,
        },
        platformHealthWarnings,
      };
    },
    // Analytics should reflect recent ops; keep it fresh.
    enabled: enabled && !!startDate && !!endDate,
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });
}
