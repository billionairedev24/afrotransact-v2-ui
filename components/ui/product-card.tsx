import { Heart, ShoppingCart, Star, Leaf, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProximityBadge } from "./proximity-badge"
import Link from "next/link"

export interface ProductCardProps {
  name: string
  price: string
  store: string
  distance: string
  rating?: number
  imageUrl?: string
  className?: string
  inStock?: boolean
  inCart?: boolean
  addingToCart?: boolean
  onAddToCart?: (e: React.MouseEvent) => void
  cartHref?: string
}

export function ProductCard({
  name,
  price,
  store,
  distance,
  rating = 4.5,
  imageUrl,
  className,
  inStock = true,
  inCart = false,
  addingToCart = false,
  onAddToCart,
  cartHref = "/cart",
}: ProductCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors",
        className
      )}
    >
      <button
        aria-label="Save to wishlist"
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur text-muted-foreground hover:text-destructive transition-colors"
      >
        <Heart className="h-4 w-4" />
      </button>

      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <Leaf className="h-12 w-12 text-muted-foreground/50" />
        )}
      </div>

      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
          {name}
        </h3>

        {rating > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            <span className="text-xs font-medium text-foreground">{rating}</span>
          </div>
        )}

        <p className="text-lg font-bold text-primary">{price}</p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{store}</span>
          {distance && <ProximityBadge distance={distance} />}
        </div>

        {!inStock ? (
          <button disabled className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground cursor-not-allowed">
            Out of Stock
          </button>
        ) : inCart ? (
          <Link
            href={cartHref}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-success/15 border border-success/20 px-3 py-2 text-xs font-medium text-success hover:bg-success/25 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            In Cart
          </Link>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart?.(e) }}
            disabled={addingToCart}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-60"
          >
            {addingToCart ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            Add to Cart
          </button>
        )}
      </div>
    </div>
  )
}
