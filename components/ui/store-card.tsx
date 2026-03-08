import { Store, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StoreCardProps {
  name: string
  type: string
  rating: number
  distance: string
  logoUrl?: string
  className?: string
}

export function StoreCard({
  name,
  type,
  rating,
  distance,
  logoUrl,
  className,
}: StoreCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors",
        className
      )}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <Store className="h-7 w-7 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-card-foreground truncate">{name}</h3>
        <p className="text-xs text-muted-foreground">{type}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="flex items-center gap-1 text-sm font-semibold text-primary">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
          {rating}
        </p>
        <p className="text-xs text-muted-foreground">{distance}</p>
      </div>
    </div>
  )
}
