"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Buyer's chosen "Deliver to" location. Persists per browser via
 * localStorage and drives PDP eligibility, cart eligibility, and the
 * checkout pre-fill. The picker (header pill) writes here; every
 * downstream surface reads.
 *
 * `prompted` flips once the buyer has been shown the first-visit modal
 * so we don't nag them forever.
 */
export interface BuyerLocation {
  postalCode: string
  country: string
  state?: string | null
  lat?: number | null
  lng?: number | null
}

interface BuyerLocationState {
  location: BuyerLocation | null
  prompted: boolean
  setLocation: (loc: BuyerLocation | null) => void
  markPrompted: () => void
}

export const useBuyerLocation = create<BuyerLocationState>()(
  persist(
    (set) => ({
      location: null,
      prompted: false,
      setLocation: (location) => set({ location, prompted: true }),
      markPrompted: () => set({ prompted: true }),
    }),
    { name: "atx.buyerLocation" },
  ),
)
