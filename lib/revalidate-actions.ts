"use server"

import { revalidatePath } from "next/cache"

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
