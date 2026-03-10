"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, MapPin, Search, Star, Store, Loader2 } from "lucide-react"
import { getAllStores, type StoreInfo } from "@/lib/api"

export default function StoresPage() {
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getAllStores()
        if (!cancelled) setStores(data)
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">Stores</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <Store className="h-7 w-7 text-primary" />
            All Stores
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Browse stores on the platform
          </p>
        </div>
        <Link href="/search" className="hidden sm:flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
          <Search className="h-4 w-4" /> Search products
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : stores.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <Store className="mx-auto h-14 w-14 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900 mt-5">No stores yet</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Stores will appear here once sellers create them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/store/${store.slug}`}
              className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="h-28 relative bg-gradient-to-br from-primary/10 via-card to-secondary/10 overflow-hidden">
                {store.bannerUrl ? (
                  <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <Store className="h-16 w-16 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-5 left-4 h-12 w-12 rounded-xl bg-card border-2 border-border flex items-center justify-center overflow-hidden">
                  {store.logoUrl ? (
                    <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-primary" />
                  )}
                </div>
              </div>

              <div className="pt-8 px-4 pb-4 space-y-2">
                <div>
                  <h2 className="font-bold text-foreground group-hover:text-primary transition-colors">{store.name}</h2>
                  {store.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{store.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {store.rating > 0 && (
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      {store.rating.toFixed(1)}
                      {store.reviewCount > 0 && (
                        <span className="text-muted-foreground font-normal">({store.reviewCount})</span>
                      )}
                    </span>
                  )}
                  {store.addressCity && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />{store.addressCity}{store.addressState ? `, ${store.addressState}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="text-gray-500 text-sm">More stores are joining every week.</p>
        <Link href="/sell" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-primary hover:text-primary/80">
          Want to list your store? <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  )
}
