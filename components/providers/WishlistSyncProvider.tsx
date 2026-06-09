"use client"

/**
 * On-login wishlist merge (backlog #43).
 *
 * Pushes any items the user accumulated anonymously in `wishlist-store`
 * (localStorage) up to the server when they authenticate, then clears the
 * local store so the server becomes the source of truth.
 *
 * Mirrors the cart-merge handoff pattern in `CartMergeProvider`, but is
 * a strict one-shot: there's no debounced push-back loop because individual
 * wishlist mutations now go straight through `useWishlist`.
 */

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { mergeWishlist } from "@/lib/api"
import { useWishlistStore } from "@/stores/wishlist-store"

export function WishlistSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  // Guard so the merge fires exactly once per authenticated session-mount,
  // not on every re-render and not while the session is still loading.
  const hasMerged = useRef(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      // Reset so a subsequent login triggers the merge.
      hasMerged.current = false
      return
    }
    if (status !== "authenticated" || !session?.accessToken) return
    if (hasMerged.current) return

    hasMerged.current = true
    const token = session.accessToken as string
    const localItems = useWishlistStore.getState().items
    const localIds = localItems.map((i) => i.productId)

    if (localIds.length === 0) {
      return
    }

    mergeWishlist(token, localIds)
      .then(() => {
        useWishlistStore.getState().clear()
        // Force the wishlist hook to re-fetch so the server set reflects the merge.
        const queryClient = queryClientRef.current
        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: ["wishlist", "me"] })
        }
      })
      .catch((err) => {
        console.warn("[WishlistSync] merge failed (non-blocking):", err)
        // Allow retry on next mount.
        hasMerged.current = false
      })
  }, [status, session?.accessToken])

  // Capture the query client in a ref so the async callback above can invalidate
  // without re-creating the effect on every render.
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  useEffect(() => {
    queryClientRef.current = queryClient
  }, [queryClient])

  return <>{children}</>
}
