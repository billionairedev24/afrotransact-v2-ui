import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CategoryRef, SearchResult } from "@/lib/api"

interface FeaturedCategoriesProps {
  categories: CategoryRef[]
  productsByCategoryId: Record<string, SearchResult[]>
}

/**
 * Prototype-style "Shop by category" grid — 4 cards per row, each card shows
 * the category name + a 2×2 thumbnail grid.
 *
 * Design-only component: consumes the existing `CategoryRef` + `SearchResult`
 * shapes — no new backend fields required. Empty slots render as a branded
 * gradient tint so the section never looks broken even when the catalog has
 * zero products on Day 1.
 */
const TINTS = [
  "bg-gradient-to-br from-amber-50 to-orange-100",
  "bg-gradient-to-br from-emerald-50 to-teal-100",
  "bg-gradient-to-br from-sky-50 to-indigo-100",
  "bg-gradient-to-br from-rose-50 to-pink-100",
]

export function FeaturedCategories({
  categories,
  productsByCategoryId,
}: FeaturedCategoriesProps) {
  const featured = categories.slice(0, 4)
  if (featured.length === 0) return null

  return (
    <section className="py-6">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((category, idx) => {
            const products = (productsByCategoryId[category.id] || []).slice(0, 4)
            const tint = TINTS[idx % TINTS.length]
            const slots = Array.from({ length: 4 }, (_, i) => products[i])

            return (
              <Card key={category.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-base font-bold text-foreground line-clamp-1">
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {slots.map((product, i) => {
                      if (product && product.image_url) {
                        return (
                          <Link
                            key={product.product_id}
                            href={`/product/${product.slug || product.product_id}`}
                            className="group block"
                          >
                            <div className={`relative aspect-square overflow-hidden rounded-lg ${tint}`}>
                              <Image
                                src={product.image_url}
                                alt={product.title}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                                className="object-cover group-hover:scale-[1.03] transition-transform duration-200"
                              />
                            </div>
                          </Link>
                        )
                      }
                      // Empty slot OR product without an image — branded gradient tile,
                      // no broken image, no placeholder icon. Looks intentional.
                      return (
                        <div
                          key={`empty-${category.id}-${i}`}
                          className={`aspect-square rounded-lg ${tint}`}
                          aria-hidden="true"
                        />
                      )
                    })}
                  </div>
                  <Link
                    href={`/category/${category.slug}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    Shop {category.name.toLowerCase()} →
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
