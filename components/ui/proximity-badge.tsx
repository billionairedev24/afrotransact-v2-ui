import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProximityBadgeProps {
  distance: string
  className?: string
}

export function ProximityBadge({ distance, className }: ProximityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-proximity-badge/15 px-2 py-0.5 text-xs font-medium text-secondary",
        className
      )}
    >
      <MapPin className="mr-1 h-3 w-3" />
      {distance}
    </span>
  )
}
