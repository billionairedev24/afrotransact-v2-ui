"use client"

import { useCallback } from "react"
import { useLocationStore } from "@/stores/location-store"

/**
 * Buyer geolocation helpers (explicit opt-in). For beta / launch without a location UX,
 * this hook deliberately does NOT request browser geolocation, IP lookups, or set a default metro.
 *
 * Consumers that need approximate coordinates later can extend `requestLocation` with consent flows.
 */
export function useUserLocation() {
  const { location, setLoading, setError, isLoading, error } = useLocationStore()

  const requestLocation = useCallback(async () => {
    setLoading(true)
    setError(null)
    setLoading(false)
  }, [setLoading, setError])

  return { location, isLoading, error, requestLocation }
}
