"use client"

// Pass 3 of regions→service_zones migration: the legacy admin Regions page
// has been folded into Settings → Service locations. Redirect any deep links
// rather than maintaining a parallel UI.
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Page() {
  const r = useRouter()
  useEffect(() => {
    r.replace("/admin/settings/zones")
  }, [r])
  return (
    <p className="p-6 text-sm text-muted-foreground">
      Service locations have moved to Settings → Service locations.
    </p>
  )
}
