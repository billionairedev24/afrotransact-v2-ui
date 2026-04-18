"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AdConfig, DEFAULT_ADS } from "@/lib/ads"
import { getPublicAds } from "@/lib/api"

interface AdsState {
  ads: AdConfig[]
  dismissed: string[]

  // Admin actions
  upsertAd: (ad: AdConfig) => void
  deleteAd: (id: string) => void
  toggleAd: (id: string) => void

  // User actions
  dismissAd: (id: string) => void
  resetDismissed: () => void

  // API sync — call once on app load
  loadFromApi: () => Promise<void>

  // Selectors
  getAd: (id: string) => AdConfig | undefined
  isVisible: (id: string) => boolean
}

export const useAdsStore = create<AdsState>()(
  persist(
    (set, get) => ({
      ads: DEFAULT_ADS,
      dismissed: [],

      upsertAd: (ad) =>
        set((state) => {
          const exists = state.ads.some((a) => a.id === ad.id)
          return {
            ads: exists
              ? state.ads.map((a) => (a.id === ad.id ? { ...ad, updatedAt: new Date().toISOString() } : a))
              : [...state.ads, { ...ad, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
          }
        }),

      deleteAd: (id) =>
        set((state) => ({ ads: state.ads.filter((a) => a.id !== id) })),

      toggleAd: (id) =>
        set((state) => ({
          ads: state.ads.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled, updatedAt: new Date().toISOString() } : a
          ),
        })),

      dismissAd: (id) =>
        set((state) => ({ dismissed: [...new Set([...state.dismissed, id])] })),

      resetDismissed: () => set({ dismissed: [] }),

      loadFromApi: async () => {
        try {
          const remote = await getPublicAds()
          if (remote.length > 0) {
            set({ ads: remote })
          }
        } catch {
          // Network unavailable — keep current (localStorage) state
        }
      },

      getAd: (id) => get().ads.find((a) => a.id === id),

      isVisible: (id) => {
        const ad = get().ads.find((a) => a.id === id)
        if (!ad || !ad.enabled) return false
        if (get().dismissed.includes(id)) return false
        return true
      },
    }),
    {
      name: "afrotransact-ads",
      partialize: (state) => ({ ads: state.ads }),
    }
  )
)
