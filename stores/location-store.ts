import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface UserLocation {
  lat: number
  lon: number
  city?: string
  region?: string
  source: "browser" | "ip" | "address" | "default"
}

interface LocationState {
  location: UserLocation | null
  isLoading: boolean
  error: string | null
  setLocation: (location: UserLocation) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearLocation: () => void
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      isLoading: false,
      error: null,
      setLocation: (location) => set({ location, isLoading: false, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      clearLocation: () => set({ location: null }),
    }),
    {
      name: "afrotransact-location",
      partialize: (state) => ({ location: state.location }),
    }
  )
)
