"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MapPin } from "lucide-react"

declare global {
  interface Window {
    google: typeof google
    __googleMapsCallback?: () => void
  }
}

interface AddressParts {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  lat: number | null
  lng: number | null
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (parts: AddressParts) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

let googleMapsLoading = false
let googleMapsLoaded = false

function loadGoogleMapsScript(): Promise<void> {
  if (googleMapsLoaded && window.google?.maps?.places) return Promise.resolve()
  if (googleMapsLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (googleMapsLoaded) {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  }

  googleMapsLoading = true

  return new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      googleMapsLoading = false
      reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"))
      return
    }

    window.__googleMapsCallback = () => {
      googleMapsLoaded = true
      googleMapsLoading = false
      resolve()
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__googleMapsCallback`
    script.async = true
    script.defer = true
    script.onerror = () => {
      googleMapsLoading = false
      reject(new Error("Failed to load Google Maps script"))
    }
    document.head.appendChild(script)
  })
}

function extractAddressParts(place: google.maps.places.PlaceResult): AddressParts {
  const parts: AddressParts = {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    lat: place.geometry?.location?.lat() ?? null,
    lng: place.geometry?.location?.lng() ?? null,
  }

  let streetNumber = ""
  let route = ""

  for (const component of place.address_components ?? []) {
    const types = component.types
    if (types.includes("street_number")) {
      streetNumber = component.long_name
    } else if (types.includes("route")) {
      route = component.long_name
    } else if (types.includes("subpremise")) {
      parts.line2 = component.long_name
    } else if (types.includes("locality") || types.includes("sublocality_level_1")) {
      parts.city = component.long_name
    } else if (types.includes("administrative_area_level_1")) {
      parts.state = component.short_name
    } else if (types.includes("postal_code")) {
      parts.zip = component.long_name
    } else if (types.includes("country")) {
      parts.country = component.short_name
    }
  }

  parts.line1 = streetNumber ? `${streetNumber} ${route}` : route

  return parts
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your address…",
  className = "",
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError("Google Maps API key not configured")
      return
    }

    loadGoogleMapsScript()
      .then(() => setLoaded(true))
      .catch((err) => setError(err.message))
  }, [])

  const initAutocomplete = useCallback(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "formatted_address"],
    })

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) return

      const parts = extractAddressParts(place)
      onChange(place.formatted_address ?? parts.line1)
      onSelect(parts)
    })

    autocompleteRef.current = autocomplete
  }, [loaded, onChange, onSelect])

  useEffect(() => {
    initAutocomplete()
  }, [initAutocomplete])

  if (error) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors ${className}`}
        />
      </div>
    )
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={loaded ? placeholder : "Loading address lookup…"}
        disabled={disabled || !loaded}
        autoComplete="off"
        className={`w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors ${className}`}
      />
    </div>
  )
}
