import { Heart, ShoppingCart, Star, Leaf, Loader2 } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ProximityBadge } from "./proximity-badge"

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
  cartQuantity?: number
  addingToCart?: boolean
  onAddToCart?: (e: React.MouseEvent) => void
  onQuantityChange?: (delta: number) => void
  cartHref?: string
  imagePriority?: boolean
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
  cartQuantity = 0,
  addingToCart = false,
  onAddToCart,
  onQuantityChange,
  cartHref = "/cart",
  imagePriority = false,
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

      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            priority={imagePriority}
          />
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
        ) : inCart && cartQuantity > 0 ? (
          <div
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="mt-1 flex w-full items-center justify-between rounded-md bg-primary px-1 py-0.5"
          >
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuantityChange?.(-1) }}
              className="flex h-7 w-7 items-center justify-center rounded text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
            >
              −
            </button>
            <span className="text-sm font-black text-[#0f0f10] tabular-nums">{cartQuantity}</span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuantityChange?.(+1) }}
              className="flex h-7 w-7 items-center justify-center rounded text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
            >
              +
            </button>
          </div>
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
