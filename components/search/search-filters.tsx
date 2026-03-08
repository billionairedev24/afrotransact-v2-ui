"use client"

import { useState } from "react"
import { Star, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchFiltersProps {
  category: string
  onCategoryChange: (category: string) => void
}

const CATEGORIES = [
  { slug: "food-grocery", name: "Food & Grocery", count: 124 },
  { slug: "services", name: "Services", count: 45 },
  { slug: "electronics", name: "Electronics", count: 38 },
  { slug: "fashion", name: "Fashion", count: 67 },
  { slug: "home-garden", name: "Home & Garden", count: 29 },
  { slug: "health-beauty", name: "Health & Beauty", count: 52 },
]

export function SearchFilters({ category, onCategoryChange }: SearchFiltersProps) {
  const [distance, setDistance] = useState(10)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [minRating, setMinRating] = useState(0)

  const hasFilters =
    category || minRating > 0 || minPrice || maxPrice || distance !== 10

  return (
    <div className="space-y-6">
      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={() => {
            onCategoryChange("")
            setDistance(10)
            setMinPrice("")
            setMaxPrice("")
            setMinRating(0)
          }}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear all filters
        </button>
      )}

      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Categories
        </h3>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() =>
                onCategoryChange(category === cat.slug ? "" : cat.slug)
              }
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                category === cat.slug
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{cat.name}</span>
              <span className="text-xs opacity-60">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Distance */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Distance: <span className="text-primary">{distance} mi</span>
        </h3>
        <input
          type="range"
          min={0.5}
          max={25}
          step={0.5}
          value={distance}
          onChange={(e) => setDistance(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0.5 mi</span>
          <span>25 mi</span>
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Price Range
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <span className="text-muted-foreground">&mdash;</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Rating */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Minimum Rating
        </h3>
        <div className="space-y-1">
          {[4, 3, 2].map((rating) => (
            <button
              key={rating}
              onClick={() => setMinRating(minRating === rating ? 0 : rating)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                minRating === rating
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 w-3.5",
                      i < rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <span>& up</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
