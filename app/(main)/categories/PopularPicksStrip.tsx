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

  useEffect(() => {
    searchProducts({ size: "20", sort_by: "rating" })
      .then((r) => setItems(r.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="mt-10 border-t border-gray-200 pt-8">
        <div className="h-6 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 w-28 shrink-0 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Popular picks</h2>
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {items.map((p) => {
            const slug = p.slug || p.product_id
            return (
              <Link
                key={p.product_id}
                href={`/product/${slug}`}
                className="shrink-0 w-[104px] sm:w-[120px] snap-start rounded-lg border border-gray-200 bg-white overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="relative aspect-square bg-gray-50 flex items-center justify-center p-1">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <p className="text-[10px] text-gray-700 line-clamp-2 px-1.5 py-1.5 leading-tight">
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
