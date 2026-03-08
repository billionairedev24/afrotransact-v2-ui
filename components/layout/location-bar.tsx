"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"

interface LocationBarProps {
  defaultLocation?: string
}

export function LocationBar({ defaultLocation = "Austin, TX" }: LocationBarProps) {
  const [location, setLocation] = useState(defaultLocation)
  const [detecting, setDetecting] = useState(false)

  function handleChangeLocation() {
    if (!navigator.geolocation) return

    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        // In a real app, reverse-geocode the coords to a city name
        setLocation("Austin, TX")
        setDetecting(false)
      },
      () => {
        setDetecting(false)
      }
    )
  }

  return (
    <div className="border-b border-border bg-muted/50">
      <div className="container flex h-9 items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-secondary" />
        <span>
          Delivering to:{" "}
          <span className="font-medium text-foreground">{location}</span>
        </span>
        <button
          onClick={handleChangeLocation}
          disabled={detecting}
          className="text-primary hover:text-accent transition-colors font-medium"
        >
          {detecting ? "detecting..." : "(change)"}
        </button>
      </div>
    </div>
  )
}
