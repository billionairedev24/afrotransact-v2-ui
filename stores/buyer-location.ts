"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { resolveServiceZone, type ResolvedZone } from "@/lib/api"

/**
 * Buyer's chosen "Deliver to" location. Persists per browser via
 * localStorage and drives PDP eligibility, cart eligibility, and the
 * checkout pre-fill. The picker (header pill) writes here; every
 * downstream surface reads.
 *
 * `prompted` flips once the buyer has been shown the first-visit modal
 * so we don't nag them forever.
 *
 * `resolvedZone` is the most-specific service zone for this location,
 * fetched lazily after setLocation. It is best-effort — a resolver miss
 * or network blip leaves it null and callers fall through to the legacy
 * regions path. Wiring resolvedZone into existing getRegionConfig call
 * sites is a follow-up; this PR only plumbs.
 */
export interface BuyerLocation {
  /** Optional — auto-detect may save just coords if reverse-geocode fails. */
  postalCode?: string
  country: string
  state?: string | null
  /** City name from reverse-geocode (used in the pill when no ZIP). */
  city?: string | null
  lat?: number | null
  lng?: number | null
}

interface BuyerLocationState {
  location: BuyerLocation | null
  prompted: boolean
  resolvedZone: ResolvedZone | null
  setLocation: (loc: BuyerLocation | null) => void
  markPrompted: () => void
  /**
   * Re-resolve the current location's service zone against the backend.
   * Used on app boot to pick up admin-side status changes (enabled →
   * disabled / coming_soon / not_serviced) without requiring the buyer to
   * re-pick their location. Without this, a disabled zone keeps showing
   * the full storefront for every buyer whose `resolvedZone` was cached
   * from before the toggle.
   */
  refreshResolvedZone: () => Promise<void>
}

export const useBuyerLocation = create<BuyerLocationState>()(
  persist(
    (set, get) => ({
      location: null,
      prompted: false,
      resolvedZone: null,
      setLocation: (location) => {
        set({ location, prompted: true, resolvedZone: null })
        if (location && location.country) {
          // Best-effort — resolver returns null on miss/error, no UI change.
          resolveServiceZone(location.country, location.state, location.postalCode, location.city)
            .then((zone) => {
              if (zone) set({ resolvedZone: zone })
            })
            .catch(() => {
              // Silent: nothing on the storefront depends on this yet.
            })
        }
      },
      markPrompted: () => set({ prompted: true }),
      refreshResolvedZone: async () => {
        const loc = get().location
        if (!loc || !loc.country) return
        try {
          const zone = await resolveServiceZone(loc.country, loc.state, loc.postalCode, loc.city)
          // Always assign — null means "no match" and we want to clear the
          // stale cached zone so the gate can fall through to country-level.
          set({ resolvedZone: zone })
        } catch {
          // Silent: stale zone is better than no zone.
        }
      },
    }),
    { name: "atx.buyerLocation" },
  ),
)
