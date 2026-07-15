import { Star } from "lucide-react"

export function StarRating({ rating, count, size = "sm" }: { rating: number; count?: number; size?: "sm" | "md" }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`${cls} ${i < filled ? "fill-brand-gold text-brand-gold" : "fill-muted text-muted-foreground/30"}`} />
      ))}
      {typeof count === "number" && (
        <span className="ml-1 text-[11px] text-muted-foreground">({count.toLocaleString()})</span>
      )}
    </div>
  )
}
