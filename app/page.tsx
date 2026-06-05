import Link from "next/link"
import Image from "next/image"
import {
  ChevronRight,
  MapPin,
  Star,
  Store,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
// REPLACED BY <HeroCarousel> (components/landing/HeroCarousel): kept import
// commented so an operator can revert by swapping the two imports/mounts.
// import { HeroCarousel } from "@/components/home/HeroCarousel"
import { HeroCarousel } from "@/components/landing/HeroCarousel"
// REPLACED BY <CategoriesBentoGrid> + <TrustMissionBand>: kept commented for
// quick revert if there's a visual regression.
// import { FeaturedProducts } from "@/components/home/FeaturedProducts"
// import { CategoryShowcaseAmazon } from "@/components/categories/CategoryShowcaseAmazon"
// import { FeaturedCategories } from "@/components/landing/FeaturedCategories"
// import { ForYouSection } from "@/components/home/ForYouSection"
import { CategoriesBentoGrid } from "@/components/landing/CategoriesBentoGrid"
import { TrustMissionBand } from "@/components/landing/TrustMissionBand"
import { ProductRow } from "@/components/landing/ProductRow"
import { fetchCategoryTiles } from "@/lib/category-tiles"
import {
  getCategories,
  getAllStores,
  getFeaturedDeals,
  getPublicHeroSlides,
  getPublicPlatformDeals,
  searchProducts,
  type CategoryRef,
  type StoreInfo,
  type DealData,
  type PlatformDealData,
  type SearchResult,
} from "@/lib/api"
import { StoreCardSkeleton } from "@/components/ui/Skeleton"

// Home is public, catalog-driven content: revalidate often enough to feel fresh,
// long enough to dedupe bursts from spiders/warm navigations.
export const revalidate = 60

const BANNER_GRADIENTS = [
  "linear-gradient(135deg, #1a2e1a, #0f1f0f)",
  "linear-gradient(135deg, #2e1a1a, #1f0f0f)",
  "linear-gradient(135deg, #1a1a2e, #0f0f1f)",
  "linear-gradient(135deg, #2e2a1a, #1f180f)",
  "linear-gradient(135deg, #1a2e2e, #0f1f1f)",
]

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

export default async function HomePage() {
  const emptySearch = { results: [] as SearchResult[] } as Awaited<ReturnType<typeof searchProducts>>
  const [
    categories,
    allStores,
    _deals,
    _platformDealsRaw,
    heroConfig,
    featuredRating,
    _featuredNewest,
    todaysDealsRes,
    trendingAustinRes,
    newLocalRes,
  ] = await Promise.all([
    safe<CategoryRef[]>(getCategories({ revalidate: 300 }), []),
    safe<StoreInfo[]>(getAllStores({ revalidate: 120 }), []),
    safe<DealData[]>(getFeaturedDeals({ revalidate: 60 }), []),
    safe<PlatformDealData[]>(getPublicPlatformDeals(undefined, { revalidate: 60 }), []),
    safe(getPublicHeroSlides({ revalidate: 60 }), []),
    safe(
      searchProducts({ size: "96", sort_by: "rating" }, { revalidate: 300 }),
      emptySearch,
    ),
    safe(
      searchProducts({ size: "8", sort_by: "newest" }, { revalidate: 60 }),
      emptySearch,
    ),
    safe(searchProducts({ is_deal: "true", size: "20" }, { revalidate: 60 }), emptySearch),
    safe(
      searchProducts(
        { region_code: "us-tx-austin", sort: "popularity", size: "20" },
        { revalidate: 120 },
      ),
      emptySearch,
    ),
    safe(searchProducts({ sort: "newest", size: "20" }, { revalidate: 60 }), emptySearch),
  ])

  // Exclude `services` everywhere in the landing render (closed-beta requirement).
  const roots = categories
    .filter((c) => c.parentId == null && c.slug !== "services")
    .slice(0, 4)

  // Warm the category tiles fetcher (keeps client traffic at zero / parity with
  // previous page). Result is unused now that the bento grid pulls from
  // productsByCategoryId, but the fetcher dedupes against future mounts.
  await fetchCategoryTiles(roots, { revalidate: 300 })

  // Build productsByCategoryId from the rating pool by name match.
  const productsByCategoryId: Record<string, SearchResult[]> = {}
  for (const cat of roots) {
    const lower = cat.name.toLowerCase()
    productsByCategoryId[cat.id] = featuredRating.results
      .filter((p) => p.categories?.some((c) => c.toLowerCase() === lower))
      .slice(0, 4)
  }

  const stores = allStores.slice(0, 6)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pb-[env(safe-area-inset-bottom,0px)] md:pb-0 space-y-10">
        {/* 1. Hero Carousel */}
        <HeroCarousel serverHeroConfigs={heroConfig} />

        {/* 2. Categories Bento Grid */}
        <CategoriesBentoGrid
          categories={roots}
          productsByCategoryId={productsByCategoryId}
        />

        {/* 3. Today's Deals */}
        <ProductRow
          title="Today's Deals"
          badge="Ending soon"
          products={todaysDealsRes.results}
          viewAllHref="/search?is_deal=true"
          viewAllLabel="See all deals"
        />

        {/* 4. Trust & Mission Band */}
        <TrustMissionBand />

        {/* 5. New Arrivals */}
        <ProductRow
          title="New Arrivals"
          products={newLocalRes.results}
          viewAllHref="/search?sort=newest"
          viewAllLabel="Explore all new items"
        />

        {/* 6. Trending in Austin (keeps the regional surface even though it's not in the mockup) */}
        <ProductRow
          title="Trending in Austin"
          products={trendingAustinRes.results}
          viewAllHref="/search?region_code=us-tx-austin&sort=popularity"
        />

        {/* Top Stores — retained from previous landing for vendor discovery */}
        <section className="bg-card/40 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Top Stores</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Discover vendors in your community
                </p>
              </div>
              <Link
                href="/stores"
                className="text-sm font-medium text-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                All stores <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.length > 0
                ? stores.map((store, i) => (
                    <Link
                      key={store.id}
                      href={`/store/${store.slug || store.id}`}
                      className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                    >
                      <div
                        className="h-28 relative"
                        style={{
                          background: store.bannerUrl
                            ? `url(${store.bannerUrl}) center/cover`
                            : BANNER_GRADIENTS[i % BANNER_GRADIENTS.length],
                        }}
                      >
                        {!store.bannerUrl && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <Store className="h-16 w-16 text-white" />
                          </div>
                        )}
                        <div className="absolute -bottom-5 left-4 h-12 w-12 rounded-xl bg-card border-2 border-border flex items-center justify-center overflow-hidden">
                          {store.logoUrl ? (
                            <Image
                              src={store.logoUrl}
                              alt={store.name}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Store className="h-6 w-6 text-foreground" />
                          )}
                        </div>
                      </div>

                      <div className="pt-8 px-4 pb-4 space-y-2">
                        <div>
                          <h3 className="font-bold text-foreground group-hover:text-foreground transition-colors">
                            {store.name}
                          </h3>
                          {store.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {store.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          {store.rating > 0 && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Star className="h-3 w-3 fill-primary text-foreground" />
                              {store.rating.toFixed(1)}
                              {store.reviewCount > 0 && (
                                <span className="text-muted-foreground font-normal">
                                  ({store.reviewCount})
                                </span>
                              )}
                            </span>
                          )}
                          {store.addressCity && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {store.addressCity}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                : Array.from({ length: 3 }).map((_, i) => <StoreCardSkeleton key={i} />)}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
