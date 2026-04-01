"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"
import { getCategories, searchProducts, type CategoryRef, type SearchResult } from "@/lib/api"
import {
  CategoryShowcaseAmazon,
  CategoryShowcaseLoading,
} from "@/components/categories/CategoryShowcaseAmazon"

function PopularPicksStrip() {
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
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-1">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="max-h-full max-w-full object-contain" />
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-[60vh] bg-[#eaeded]">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 mb-1 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-gray-900 font-medium">Categories</span>
        </div>

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Shop by category</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Browse products from immigrant-owned stores near you
          </p>
        </div>

        {loading ? (
          <CategoryShowcaseLoading />
        ) : categories.length === 0 ? (
          <p className="text-center text-gray-600 py-20 bg-white rounded-lg border border-gray-200">
            No categories available yet.
          </p>
        ) : (
          <>
            <CategoryShowcaseAmazon categories={categories} maxParents={16} />
            <PopularPicksStrip />
          </>
        )}
      </div>
    </main>
  )
}
