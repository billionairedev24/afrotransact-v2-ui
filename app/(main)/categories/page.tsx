import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getCategories } from "@/lib/api"
import { CategoryShowcaseAmazon } from "@/components/categories/CategoryShowcaseAmazon"
import { fetchCategoryTiles } from "@/lib/category-tiles"
import { PopularPicksStrip } from "./PopularPicksStrip"

/**
 * `/categories` — Shop-by-category index.
 *
 * Rendered as a **Server Component** so we can pre-compute tile images via
 * `fetchCategoryTiles`. The previous client-side version fired N × 5
 * `/api/v1/search?category=…` requests on mount (16 parents × 5 = 80 parallel
 * calls), which tripped the gateway's sensitive-endpoint rate limiter with a
 * 429 on every cold load.
 *
 * Now the heavy lifting happens once on the server (one `size=96` search,
 * cached for 5 min via Next.js's fetch cache) and the client renders
 * synchronously with zero search traffic.
 */
export const revalidate = 300

const MAX_PARENTS = 16

export default async function CategoriesPage() {
  // One categories call (reused below for the tile pool) — Next's fetch
  // cache handles dedup + revalidation so there's effectively one gateway
  // hit per 5 min per route.
  const categories = await getCategories({ revalidate: 300 }).catch(() => [])
  const roots = categories.filter((c) => c.parentId == null).slice(0, MAX_PARENTS)
  const tiles = await fetchCategoryTiles(roots, { revalidate: 300, size: 96 })

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

        {categories.length === 0 ? (
          <p className="text-center text-gray-600 py-20 bg-white rounded-lg border border-gray-200">
            No categories available yet.
          </p>
        ) : (
          <>
            <CategoryShowcaseAmazon
              categories={categories}
              maxParents={MAX_PARENTS}
              initialTiles={tiles}
            />
            <PopularPicksStrip />
          </>
        )}
      </div>
    </main>
  )
}
