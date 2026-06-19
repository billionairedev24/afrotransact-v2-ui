"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Per-tab persisted selection of the active seller store. Used by every
 * seller dashboard surface so multi-store sellers can flip context without
 * re-fetching their seller record.
 *
 * `setActiveStoreId(null)` clears the selection. Selecting a store that no
 * longer exists falls back to the first available one on next read.
 */
interface ActiveStoreState {
  activeStoreId: string | null
  setActiveStoreId: (id: string | null) => void
}

export const useActiveStore = create<ActiveStoreState>()(
  persist(
    (set) => ({
      activeStoreId: null,
      setActiveStoreId: (id) => set({ activeStoreId: id }),
    }),
    { name: "atx.activeStoreId" },
  ),
)
