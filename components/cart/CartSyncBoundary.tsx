"use client"

/**
 * CartSyncBoundary — brief-mandated name; implementation lives in
 * `components/providers/CartMergeProvider.tsx` (already mounted in the
 * Providers tree). This file re-exports the implementation so consumers can
 * import either name and we don't create parallel wiring.
 */

export {
  CartMergeProvider as CartSyncBoundary,
  useCartHydration,
} from "@/components/providers/CartMergeProvider"
