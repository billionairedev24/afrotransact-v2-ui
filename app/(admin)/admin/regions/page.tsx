"use client"

// Regions are deprecated. Every operational-area setting now lives on
// /admin/zones (Service Locations). Any deep link into the old regions
// screens redirects there.
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Page() {
  const r = useRouter()
  useEffect(() => {
    r.replace("/admin/zones")
  }, [r])
  return (
    <p className="p-6 text-sm text-muted-foreground">
      Regions were replaced by Service Locations. Redirecting…
    </p>
  )
}
