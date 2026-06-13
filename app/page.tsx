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
  getFeaturedDeals,
  getPublicHeroSlides,
  getPublicPlatformDeals,
  searchProducts,
  type CategoryRef,
  type DealData,
  type PlatformDealData,
  type SearchResult,
} from "@/lib/api"

// Home is public, catalog-driven content: revalidate often enough to feel fresh,
// long enough to dedupe bursts from spiders/warm navigations.
export const revalidate = 30

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

      </main>

      <Footer />
    </div>
  )
}
