"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Check, Store as StoreIcon, Plus, Lock } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { getCurrentSeller, getSellerStoresWithQuota } from "@/lib/api"
import { useActiveStore } from "@/stores/active-store"
import { cn } from "@/lib/utils"

/**
 * Top-of-shell store switcher. Reads the seller's stores + plan quota in
 * one call. The dropdown shows every store + a quota chip ("2 of 3 stores")
 * and a context-aware "Open another store" affordance:
 *   - quota not yet hit → links to /dashboard/store?new=1 (create form)
 *   - quota exceeded   → links to /dashboard/subscription (upgrade plan)
 *
 * Persists the selected storeId via the activeStore zustand store; every
 * other seller page reads from there so picking a store scopes the whole
 * dashboard.
 */
export function StoreSwitcher() {
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const activeStoreId = useActiveStore((s) => s.activeStoreId)
  const setActiveStoreId = useActiveStore((s) => s.setActiveStoreId)

  const sellerQuery = useQuery({
    queryKey: ["seller-shell-current-seller"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getCurrentSeller(token)
    },
    enabled: status === "authenticated",
    staleTime: 10 * 60 * 1000,
  })

  const storesQuery = useQuery({
    queryKey: ["seller-shell-stores", sellerQuery.data?.id],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getSellerStoresWithQuota(token, sellerQuery.data!.id)
    },
    enabled: !!sellerQuery.data?.id,
    staleTime: 60 * 1000,
  })

  const stores = storesQuery.data?.stores ?? []

  // Reconcile the persisted selection: if the active id doesn't exist anymore
  // (deleted store, signed-in as a different seller), fall back to the first.
  useEffect(() => {
    if (!stores.length) return
    const stillExists = activeStoreId && stores.some((s) => s.id === activeStoreId)
    if (!stillExists) setActiveStoreId(stores[0].id)
  }, [stores, activeStoreId, setActiveStoreId])

  const active = stores.find((s) => s.id === activeStoreId) ?? stores[0]

  if (storesQuery.isLoading || !active) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-500 text-sm">
        <StoreIcon className="h-4 w-4" />
        <span>Loading…</span>
      </div>
    )
  }

  const used = storesQuery.data?.used ?? stores.length
  const quota = storesQuery.data?.quota
  const canAdd = storesQuery.data?.canAddStore ?? false

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-sm font-semibold text-gray-900 transition-colors min-w-[180px] max-w-[260px]"
      >
        <StoreIcon className="h-4 w-4 text-gray-500 shrink-0" />
        <span className="truncate flex-1 text-left">{active.name}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-md shadow-lg border border-gray-200 z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
              <span>Your stores</span>
              <span>{used}{quota != null && ` of ${quota}`}</span>
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {stores.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => { setActiveStoreId(s.id); setOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <StoreIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="flex-1 text-sm truncate">{s.name}</span>
                    {s.id === active.id && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100">
              {canAdd ? (
                <Link
                  href="/dashboard/store?new=1"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" /> Open another store
                </Link>
              ) : (
                <Link
                  href="/dashboard/subscription"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                >
                  <Lock className="h-4 w-4" /> Upgrade plan to add more stores
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
