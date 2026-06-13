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
    todaysDeals,
    _platformDealsRaw,
    heroConfig,
    featuredRating,
    _featuredNewest,
    trendingAustinRes,
    newLocalRes,
  ] = await Promise.all([
    safe<CategoryRef[]>(getCategories({ revalidate: 300 }), []),
    // Today's Deals: source from the deals endpoint, NOT from
    // searchProducts({is_deal:"true"}) — the search service silently
    // ignores is_deal so it was returning every product, including
    // non-deals. Deals endpoint already enforces enabled+window+discount.
    safe<DealData[]>(getFeaturedDeals({ revalidate: 30 }), []),
    safe<PlatformDealData[]>(getPublicPlatformDeals(undefined, { revalidate: 60 }), []),
    safe(getPublicHeroSlides({ revalidate: 60 }), []),
    safe(
      // Powers the category bento grid. 30s matches the page-level ISR so
      // an ES re-index lands on the next request instead of staying stale
      // for 5 minutes after a seller updates a product.
      searchProducts({ size: "96", sort_by: "rating" }, { revalidate: 30 }),
      emptySearch,
    ),
    safe(
      searchProducts({ size: "8", sort_by: "newest" }, { revalidate: 60 }),
      emptySearch,
    ),
    safe(
      searchProducts(
        { region_code: "us-tx-austin", sort: "popularity", size: "20" },
        { revalidate: 120 },
      ),
      emptySearch,
    ),
    safe(searchProducts({ sort: "newest", size: "20" }, { revalidate: 60 }), emptySearch),
  ])

  // Map deals -> SearchResult-compatible mini cards so ProductRow can
  // reuse its existing rendering. Apply the same strict filter as /deals
  // so non-deal rows can never appear here.
  const now = Date.now()
  const todaysDealsRes = {
    ...emptySearch,
    results: todaysDeals
      .filter((d) => d.productId && d.productImageUrl)
      .filter((d) => d.enabled !== false && d.active !== false)
      .filter((d) => !d.startAt || new Date(d.startAt).getTime() <= now)
      .filter((d) => !d.endAt || new Date(d.endAt).getTime() > now)
      .filter((d) => {
        if (d.discountPercent && d.discountPercent > 0) return true
        if (d.dealPriceCents != null && d.originalPriceCents != null
            && d.dealPriceCents < d.originalPriceCents) return true
        return false
      })
      .map<SearchResult>((d) => {
        const price = (d.dealPriceCents ?? 0) / 100
        const original = (d.originalPriceCents ?? d.dealPriceCents ?? 0) / 100
        return {
          product_id: d.productId!,
          store_id: d.storeId,
          store_name: d.storeName ?? "",
          title: d.productTitle || d.title,
          description: "",
          product_type: "",
          categories: [],
          min_price: price,
          max_price: original,
          currency: "USD",
          in_stock: true,
          image_url: d.productImageUrl,
          avg_rating: 0,
          review_count: 0,
          distance_miles: null,
          highlight_title: null,
          highlight_description: null,
          score: null,
          slug: d.productSlug ?? undefined,
        }
      }),
  }

  // Exclude `services` everywhere in the landing render (closed-beta requirement).
  const roots = categories
    .filter((c) => c.parentId == null && c.slug !== "services")
    .slice(0, 4)

  // Warm the category tiles fetcher (keeps client traffic at zero / parity with
  // previous page). Result is unused now that the bento grid pulls from
  // productsByCategoryId, but the fetcher dedupes against future mounts.
  await fetchCategoryTiles(roots, { revalidate: 300 })

  // Build productsByCategoryId by matching the product's leaf categories
  // against the ROOT category AND all of its descendants (case-insensitive
  // on both name and slug). The previous version only matched the root
  // name, so a product tagged with a leaf like "Beans" under "Groceries"
  // never showed up in the Groceries tile.
  const childrenByParent = new Map<string, string[]>()
  for (const c of categories) {
    if (c.parentId) {
      const list = childrenByParent.get(c.parentId) ?? []
      list.push(c.name.toLowerCase(), c.slug.toLowerCase())
      childrenByParent.set(c.parentId, list)
    }
  }
  function collectDescendantTokens(rootId: string, rootName: string, rootSlug: string): Set<string> {
    const tokens = new Set<string>([rootName.toLowerCase(), rootSlug.toLowerCase()])
    const queue = [rootId]
    while (queue.length) {
      const id = queue.shift()!
      for (const c of categories) {
        if (c.parentId === id) {
          tokens.add(c.name.toLowerCase())
          tokens.add(c.slug.toLowerCase())
          queue.push(c.id)
        }
      }
    }
    return tokens
  }
  // Amazon-style sub-category tiles per root: for each child of a root, pick
  // a representative product image so the tile reads as "Beans" / "Spices" /
  // "Grains", not as four random product images. Falls back to root-pool
  // products when a child has no indexed product yet.
  type BentoTile = {
    label: string
    categorySlug: string
    image: string | null
    productSlug?: string
  }
  const tilesByRoot: Record<string, BentoTile[]> = {}
  for (const cat of roots) {
    const children = categories.filter((c) => c.parentId === cat.id)
    const rootTokens = collectDescendantTokens(cat.id, cat.name, cat.slug)
    const rootPool = featuredRating.results
      .filter((p) => p.image_url)
      .filter((p) => p.categories?.some((c) => rootTokens.has(c.toLowerCase())))

    const tiles: BentoTile[] = []
    const used = new Set<string>()

    for (const child of children.slice(0, 4)) {
      const childTokens = new Set<string>([child.name.toLowerCase(), child.slug.toLowerCase()])
      const match = rootPool.find(
        (p) => !used.has(p.product_id)
          && p.categories?.some((c) => childTokens.has(c.toLowerCase())),
      )
      if (match) used.add(match.product_id)
      tiles.push({
        label: child.name,
        categorySlug: child.slug,
        image: match?.image_url ?? null,
        productSlug: match?.slug,
      })
    }

    // Pad with root-pool products (labeled with root name) when there aren't
    // enough children or the children had no images yet — never render empty.
    let poolIdx = 0
    while (tiles.length < 4 && poolIdx < rootPool.length) {
      const p = rootPool[poolIdx++]
      if (used.has(p.product_id)) continue
      used.add(p.product_id)
      tiles.push({
        label: cat.name,
        categorySlug: cat.slug,
        image: p.image_url,
        productSlug: p.slug,
      })
    }

    tilesByRoot[cat.id] = tiles.filter((t) => t.image)
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
          tilesByRoot={tilesByRoot}
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
