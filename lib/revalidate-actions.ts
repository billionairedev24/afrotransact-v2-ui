"use server"

import { revalidatePath, revalidateTag } from "next/cache"

/**
 * Server action: bust the Vercel ISR snapshot for every store profile
 * page. Called from admin product approve/reject so freshly-listed
 * products show on the seller's storefront within the next request
 * instead of waiting for the 30s ISR window.
 *
 * Segment-level revalidation (`/store/[slug]` + `pathType: "page"`)
 * invalidates all `/store/*` snapshots in one call — fine at our scale
 * and avoids needing to look up the seller's slug from a product id.
 *
 * Runs server-side only (no exposed endpoint, no shared secret needed —
 * the surrounding admin page is already gated by role).
 */
export async function revalidateStorefronts(): Promise<void> {
  revalidatePath("/store/[slug]", "page")
}

/**
 * Revalidates a specific product page by its slug.
 * Invalidates both the product tag and the product page path.
 */
export async function revalidateProduct(slug: string): Promise<void> {
  revalidateTag(`product:${slug}`, "default")
  revalidatePath(`/product/${slug}`)
}

/**
 * Revalidates the search results page.
 * Invalidates both the search tag and the search page path.
 */
export async function revalidateSearch(): Promise<void> {
  revalidateTag("search", "default")
  revalidatePath("/search")
}

/**
 * Revalidates the deals page.
 * Invalidates both the deals tag and the deals page path.
 */
export async function revalidateDeals(): Promise<void> {
  revalidateTag("deals", "default")
  revalidatePath("/deals")
}

/**
 * Revalidates the home data API endpoint.
 */
export async function revalidateHomeData(): Promise<void> {
  revalidatePath("/api/public/home-data")
}

/**
 * Revalidates the seller product list page in the dashboard.
 */
export async function revalidateSellerProductList(): Promise<void> {
  revalidatePath("/dashboard/products")
}

/**
 * Revalidates all storefront pages.
 * Alias for revalidateStorefronts — extracted as a separate export
 * for clarity when explicitly targeting all store fronts.
 */
export async function revalidateAllStorefronts(): Promise<void> {
  revalidatePath("/store/[slug]", "page")
}