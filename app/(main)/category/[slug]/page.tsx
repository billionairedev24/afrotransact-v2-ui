"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Star, MapPin, Leaf, Loader2 } from "lucide-react"
import { searchProducts, getCategories, type SearchResult, type CategoryRef } from "@/lib/api"

export default function CategoryPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [name, setName] = useState(slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
  const [products, setProducts] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    // Fetch categories to find the correct name for the slug
    getCategories()
      .then((cats) => {
        const findName = (list: CategoryRef[]): string | null => {
          for (const c of list) {
            if (c.slug === slug) return c.name
            if (c.children) {
              const childName = findName(c.children)
              if (childName) return childName
            }
          }
          return null
        }
        const found = findName(cats)
        if (found) setName(found)
      })
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    setLoading(true)
    searchProducts({ category: name, size: "24" })
      .then((res) => {
        setProducts(res.results)
        setTotal(res.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [name])

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/categories" className="hover:text-gray-300 transition-colors">Categories</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">{name}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">{name}</h1>
        <p className="text-gray-500 mt-1">
          {loading ? "Loading products..." : `${total} product${total !== 1 ? "s" : ""} from local stores`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Leaf className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No products found in this category yet.</p>
          <Link href="/" className="text-primary text-sm mt-2 inline-block hover:text-primary/80">
            Browse all products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {products.map((product) => (
            <Link
              key={product.product_id}
              href={`/product/${product.slug || product.product_id}`}
              className="group rounded-xl sm:rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="h-[110px] sm:h-[140px] md:aspect-square bg-gradient-to-br from-muted to-muted/50 relative flex items-center justify-center overflow-hidden">
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
              <div className="p-2 sm:p-3 space-y-1 sm:space-y-1.5">
                <h3 className="text-[11px] sm:text-[13px] font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
                  {product.title}
                </h3>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-sm sm:text-[15px] font-bold text-primary">${product.min_price.toFixed(2)}</span>
                  {product.max_price > product.min_price && (
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground">– ${product.max_price.toFixed(2)}</span>
                  )}
                </div>
                {product.avg_rating > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    <span className="text-[11px] font-medium text-foreground">{product.avg_rating.toFixed(1)}</span>
                    <span className="text-[11px] text-muted-foreground">({product.review_count})</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-0.5 gap-1">
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{product.store_name}</span>
                  {product.distance_miles != null && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-secondary shrink-0">
                      <MapPin className="h-2.5 w-2.5" />{product.distance_miles.toFixed(1)} mi
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
