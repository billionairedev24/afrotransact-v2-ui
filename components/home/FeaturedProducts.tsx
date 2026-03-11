"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Star, MapPin, Leaf, ChevronRight, Sparkles } from "lucide-react"
import { searchProducts, type SearchResult } from "@/lib/api"

interface Props {
  title?: string
  subtitle?: string
  sortBy?: string
  size?: number
  viewAllHref?: string
  icon?: React.ReactNode
}

export function FeaturedProducts({
  title = "Fresh Near You",
  subtitle,
  sortBy = "rating",
  size = 8,
  viewAllHref = "/search?sort=rating",
  icon,
}: Props) {
  const [products, setProducts] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    searchProducts({ size: String(size), sort_by: sortBy })
      .then((res) => setProducts(res.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sortBy, size])

  if (loading) {
    return (
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                {icon || <MapPin className="h-3.5 w-3.5 text-primary" />}
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              {icon || <MapPin className="h-3.5 w-3.5 text-primary" />}
              {subtitle}
            </p>
          )}
        </div>
        <Link
          href={viewAllHref}
          className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {products.map((product) => (
          <Link
            key={product.product_id}
            href={`/product/${product.slug || product.product_id}`}
            className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
          >
            <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <Leaf className="h-10 w-10 text-muted-foreground/30" />
              )}
              {!product.in_stock && (
                <span className="absolute top-2 left-2 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500/90 text-white">
                  Out of Stock
                </span>
              )}
            </div>

            <div className="p-3 space-y-1.5">
              <h3 className="text-[13px] font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
                {product.title}
              </h3>

              <div className="flex items-center gap-1">
                <span className="text-[15px] font-bold text-primary">${product.min_price.toFixed(2)}</span>
                {product.max_price > product.min_price && (
                  <span className="text-[11px] text-muted-foreground">– ${product.max_price.toFixed(2)}</span>
                )}
              </div>

              {product.avg_rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-primary text-primary" />
                  <span className="text-[11px] font-medium text-foreground">{product.avg_rating.toFixed(1)}</span>
                  <span className="text-[11px] text-muted-foreground">({product.review_count})</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-muted-foreground truncate">{product.store_name}</span>
                {product.distance_miles != null && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-secondary shrink-0">
                    <MapPin className="h-2.5 w-2.5" />
                    {product.distance_miles.toFixed(1)} mi
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
