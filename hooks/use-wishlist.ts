"use client"

/**
 * Wishlist hook with cross-device sync (backlog #43).
 *
 * - Authenticated users: source of truth is the user-profile service. Reads
 *   page from the server, writes go through optimistic-update mutations.
 * - Anonymous users: falls back to the existing localStorage zustand store
 *   (`stores/wishlist-store.ts`) so saved items survive reloads on the same
 *   device.
 *
 * The on-login merge (push local items, then clear local store) is handled
 * separately by `WishlistSyncProvider`, which runs once per session-mount.
 */

import { useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { getAccessToken } from "@/lib/auth-helpers"
import { addToWishlist, getWishlist, removeFromWishlist } from "@/lib/api"
import { useWishlistStore } from "@/stores/wishlist-store"

const WISHLIST_KEY = ["wishlist", "me"] as const

export interface UseWishlistResult {
  /** Set of product IDs currently in the wishlist. */
  ids: Set<string>
  /** Is the data still loading from the server (authenticated only). */
  loading: boolean
  /** Is the (productId, userId) pair currently saved. */
  has: (productId: string) => boolean
  /** Add a product; idempotent. Falls back to local store for anonymous users. */
  add: (productId: string) => Promise<void>
  /** Remove a product; idempotent. */
  remove: (productId: string) => Promise<void>
  /** Toggle. Returns true if the product is now in the wishlist after the call. */
  toggle: (productId: string) => Promise<boolean>
}

export function useWishlist(): UseWishlistResult {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"
  const queryClient = useQueryClient()

  // Local-store mirror for anonymous fallback. We pull `items` so this hook
  // re-renders when the local list changes.
  const localItems = useWishlistStore((s) => s.items)
  const localAdd = useWishlistStore((s) => s.add)
  const localRemove = useWishlistStore((s) => s.remove)

  const query = useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) return { content: [] as string[] }
      // The PDP heart toggle only needs a "has it?" answer — a single page of
      // 100 covers the vast majority of users; the dedicated wishlist page
      // pages explicitly through useWishlistPage().
      return getWishlist(token, 0, 100)
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const serverIds = useMemo(
    () => new Set<string>(query.data?.content ?? []),
    [query.data],
  )

  const ids = useMemo(() => {
    if (isAuthenticated) return serverIds
    return new Set(localItems.map((i) => i.productId))
  }, [isAuthenticated, serverIds, localItems])

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return addToWishlist(token, productId)
    },
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_KEY })
      const prev = queryClient.getQueryData<{ content: string[] }>(WISHLIST_KEY)
      queryClient.setQueryData<{ content: string[] }>(WISHLIST_KEY, (old) => ({
        ...(old ?? { content: [] }),
        content: Array.from(new Set([productId, ...(old?.content ?? [])])),
      }))
      return { prev }
    },
    onError: (_err, _productId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(WISHLIST_KEY, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_KEY })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return removeFromWishlist(token, productId)
    },
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_KEY })
      const prev = queryClient.getQueryData<{ content: string[] }>(WISHLIST_KEY)
      queryClient.setQueryData<{ content: string[] }>(WISHLIST_KEY, (old) => ({
        ...(old ?? { content: [] }),
        content: (old?.content ?? []).filter((p) => p !== productId),
      }))
      return { prev }
    },
    onError: (_err, _productId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(WISHLIST_KEY, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_KEY })
    },
  })

  const has = useCallback(
    (productId: string) => ids.has(productId),
    [ids],
  )

  const add = useCallback(
    async (productId: string) => {
      if (isAuthenticated) {
        await addMutation.mutateAsync(productId)
        return
      }
      // For anonymous users the local store needs more than the productId —
      // callers that care about visual metadata (title/image/price) should
      // continue to use the local store directly via useWishlistStore. Here
      // we record a minimal entry so `has()` works on the PDP.
      localAdd({ productId, slug: productId, title: "", priceCents: 0 })
    },
    [isAuthenticated, addMutation, localAdd],
  )

  const remove = useCallback(
    async (productId: string) => {
      if (isAuthenticated) {
        await removeMutation.mutateAsync(productId)
        return
      }
      localRemove(productId)
    },
    [isAuthenticated, removeMutation, localRemove],
  )

  const toggle = useCallback(
    async (productId: string) => {
      if (has(productId)) {
        await remove(productId)
        return false
      }
      await add(productId)
      return true
    },
    [has, add, remove],
  )

  return {
    ids,
    loading: isAuthenticated && query.isLoading,
    has,
    add,
    remove,
    toggle,
  }
}
