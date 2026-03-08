"use client"

import { useEffect, useCallback } from "react"
import { useLocationStore } from "@/stores/location-store"

export function useUserLocation() {
  const { location, setLocation, setLoading, setError, isLoading, error } = useLocationStore()

  const requestLocation = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Try browser geolocation
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000, // 5 minutes
          })
        })
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          source: "browser",
        })
        setLoading(false)
        return
      } catch {
        // Fall through to IP geolocation
      }
    }

    // Try IP-based geolocation (free API)
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        if (data.latitude && data.longitude) {
          setLocation({
            lat: data.latitude,
            lon: data.longitude,
            city: data.city,
            region: data.region,
            source: "ip",
          })
          setLoading(false)
          return
        }
      }
    } catch {
      // Fall through to default
    }

    // Default: Austin, TX
    setLocation({
      lat: 30.2672,
      lon: -97.7431,
      city: "Austin",
      region: "TX",
      source: "default",
    })
    setLoading(false)
  }, [setLocation, setLoading, setError])

  useEffect(() => {
    if (!location) {
      requestLocation()
    }
  }, [location, requestLocation])

  return { location, isLoading, error, requestLocation }
}
