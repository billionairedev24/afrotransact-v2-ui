import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAllStores, type StoreInfo } from "@/lib/api"

export function useAllStores() {
  return useQuery({
    queryKey: ["stores", "all"],
    queryFn: () => getAllStores(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useStoreNameMap() {
  const q = useAllStores()
  const map = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of (q.data ?? []) as StoreInfo[]) {
      if (s?.id && s?.name) m.set(s.id, s.name)
    }
    return m
  }, [q.data])

  const nameFor = useCallback(
    (id: string | null | undefined) =>
      id ? (map.get(id) ?? `Store ${id.slice(0, 8)}…`) : "—",
    [map],
  )

  return {
    map,
    isLoading: q.isLoading,
    nameFor,
  }
}
