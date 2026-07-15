"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Package } from "lucide-react"
import { searchProducts, type SearchResult } from "@/lib/api"

/**
 * Horizontal "Popular picks" strip shown below the category grid.
 *
 * Lives in its own client module so the parent `categories/page.tsx` can be
 * a Server Component (which lets us server-render the heavy
 * `CategoryShowcaseAmazon` with pre-computed tiles — that in turn
 * eliminates ~80 client-side `/api/v1/search` calls on first paint and
 * keeps us off the gateway's rate-limit list).
 */
export function PopularPicksStrip() {
  const [items, setItems] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    searchProducts({ size: "20", sort_by: "rating" })
      .then((r) => setItems(r.results))
      .catch((err) => {
        if (err instanceof Error) setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="mt-10 border-t border-border pt-8">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 w-28 shrink-0 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-lg font-bold text-foreground mb-2">Popular picks</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="text-lg font-bold text-foreground mb-4">Popular picks</h2>
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {items.map((p) => {
            const slug = p.slug || p.product_id
            return (
              <Link
                key={p.product_id}
                href={`/product/${slug}`}
                className="shrink-0 w-[104px] sm:w-[120px] snap-start rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="relative aspect-square bg-muted flex items-center justify-center p-1">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2 px-1.5 py-1.5 leading-tight">
                  {p.title}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
