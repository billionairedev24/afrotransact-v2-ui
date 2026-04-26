"use client"

import { useCallback, useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { getAccessToken } from "@/lib/auth-helpers"
import { getProductById, getUserProfileById, type Product, type UserProfile } from "@/lib/api"

const PRODUCT_STALE_TIME = 5 * 60 * 1000
const USER_STALE_TIME = 5 * 60 * 1000

function uniq(ids: (string | null | undefined)[]): string[] {
  const out = new Set<string>()
  for (const id of ids) if (id) out.add(id)
  return Array.from(out)
}

export function useProductLookup(productIds: (string | null | undefined)[]) {
  const ids = useMemo(() => uniq(productIds), [productIds])

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["product-lookup", id],
      queryFn: () => getProductById(id),
      staleTime: PRODUCT_STALE_TIME,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  })

  const map = useMemo(() => {
    const m = new Map<string, Product>()
    queries.forEach((q, i) => {
      if (q.data) m.set(ids[i], q.data)
    })
    return m
  }, [queries, ids])

  const titleFor = useCallback(
    (id: string | null | undefined) =>
      id ? (map.get(id)?.title ?? `Product ${id.slice(0, 8)}…`) : "—",
    [map],
  )

  const storeIdFor = useCallback(
    (id: string | null | undefined) => (id ? map.get(id)?.storeId ?? null : null),
    [map],
  )

  return { map, titleFor, storeIdFor, isLoading: queries.some((q) => q.isLoading) }
}

export function useUserLookup(userIds: (string | null | undefined)[]) {
  const ids = useMemo(() => uniq(userIds), [userIds])

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["user-lookup", id],
      queryFn: async () => {
        const token = await getAccessToken()
        if (!token) throw new Error("Not authenticated")
        return getUserProfileById(token, id)
      },
      staleTime: USER_STALE_TIME,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  })

  const map = useMemo(() => {
    const m = new Map<string, UserProfile>()
    queries.forEach((q, i) => {
      if (q.data) m.set(ids[i], q.data)
    })
    return m
  }, [queries, ids])

  const nameFor = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "—"
      const u = map.get(id)
      if (!u) return `User ${id.slice(0, 8)}…`
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim()
      return name || u.email || `User ${id.slice(0, 8)}…`
    },
    [map],
  )

  return { map, nameFor, isLoading: queries.some((q) => q.isLoading) }
}
