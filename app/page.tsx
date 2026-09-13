import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PromoSlot } from "@/components/marketing/PromoSlot"
import { TickerBar } from "@/components/marketing/TickerBar"
import { PromoPopupModal } from "@/components/marketing/PromoPopupModal"
import { GeoGate } from "@/components/geo/GeoGate"
import { ForYouRail } from "@/components/orders/ForYouRail"
import { HeroSplit } from "@/components/landing/HeroSplit"
import { CategoryRail } from "@/components/landing/CategoryRail"
import { TrustMissionBand } from "@/components/landing/TrustMissionBand"
import { ProductRow } from "@/components/landing/ProductRow"
import { SellOnAfrotransactStrip } from "@/components/landing/SellOnAfrotransactStrip"
import { SellerRail } from "@/components/landing/SellerRail"
import { HomeViews } from "@/components/landing/HomeViews"
import { resolveHomepageCategories } from "@/lib/homepage-categories"
import {
  getAllStores,
  getCategories,
  getFeaturedDeals,
  searchProducts,
  type CategoryRef,
  type DealData,
  type SearchResult,
  type StoreInfo,
} from "@/lib/api"

// Home is public, catalog-driven content: revalidate often enough to feel fresh,
// long enough to dedupe bursts from spiders/warm navigations.
export const revalidate = 30

/**
 * Swallows an upstream failure and substitutes a fallback.
 *
 * Note what this does NOT do: it only catches THROWS. An upstream that returns
 * a well-formed 200 with an unexpected envelope passes straight through, which
 * is why every consumer below also defaults its own shape rather than trusting
 * `res.results` to exist.
 */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

/** Every name and slug at or below a root, lowercased, for matching search hits. */
function descendantTokens(root: CategoryRef): Set<string> {
  const tokens = new Set<string>()
  const walk = (node: CategoryRef) => {
    tokens.add(node.name.toLowerCase())
    tokens.add(node.slug.toLowerCase())
    for (const child of node.children ?? []) walk(child)
  }
  walk(root)
  return tokens
}

export default async function HomePage() {
  const emptySearch = { results: [] as SearchResult[] } as Awaited<ReturnType<typeof searchProducts>>

  const [categories, featuredDeals, newArrivals, underTwenty, ratingPool, stores] = await Promise.all([
    safe<CategoryRef[]>(getCategories({ revalidate: 300 }), []),
    // Sourced from the deals endpoint rather than searchProducts({is_deal}):
    // the search service silently ignores that filter and would return the
    // entire catalogue as "deals".
    safe<DealData[]>(getFeaturedDeals({ revalidate: 30 }), []),
    safe(searchProducts({ sort: "newest", size: "20" }, { revalidate: 60 }), emptySearch),
    // A price angle, not a volume angle. A small catalogue can fill a themed
    // row honestly where "bestsellers" would just repeat the same products.
    safe(searchProducts({ max_price: "20", size: "20" }, { revalidate: 120 }), emptySearch),
    // Supplies one representative photo per category circle.
    safe(searchProducts({ size: "96", sort_by: "rating" }, { revalidate: 60 }), emptySearch),
    // Sellers are the differentiator, so they get a row rather than one hero
    // button. Cached longer than the catalogue — the roster changes rarely.
    safe<StoreInfo[]>(getAllStores({ revalidate: 300 }), []),
  ])

  // ── Category destinations ────────────────────────────────────────────────
  // One representative image per root, taken from any descendant category.
  const imageByCategoryId: Record<string, string | null> = {}
  for (const root of categories.filter((c) => c.parentId == null)) {
    const tokens = descendantTokens(root)
    const hit = (ratingPool.results ?? []).find(
      (p) => p.image_url && p.categories?.some((c) => tokens.has(c.toLowerCase())),
    )
    imageByCategoryId[root.id] = hit?.image_url ?? null
  }
  const destinations = resolveHomepageCategories(categories, imageByCategoryId)

  // ── Today's deals ────────────────────────────────────────────────────────
  // Same strict filter as /deals, so a non-deal can never appear in a row
  // labelled "ending soon".
  const now = Date.now()
  const dealResults: SearchResult[] = (featuredDeals ?? [])
    .filter((d) => d.productId && d.productImageUrl)
    .filter((d) => d.enabled !== false && d.active !== false)
    .filter((d) => !d.startAt || new Date(d.startAt).getTime() <= now)
    .filter((d) => !d.endAt || new Date(d.endAt).getTime() > now)
    .filter((d) => {
      if (d.discountPercent && d.discountPercent > 0) return true
      if (
        d.dealPriceCents != null &&
        d.originalPriceCents != null &&
        d.dealPriceCents < d.originalPriceCents
      )
        return true
      return false
    })
    .map<SearchResult>((d) => {
      const price = (d.dealPriceCents ?? 0) / 100
      return {
        product_id: d.productId!,
        store_id: "",
        store_name: "",
        title: d.productTitle ?? "",
        description: "",
        product_type: "physical",
        categories: [],
        min_price: price,
        max_price: price,
        currency: "USD",
        in_stock: true,
        image_url: d.productImageUrl ?? null,
        avg_rating: 0,
        review_count: 0,
        distance_miles: null,
        highlight_title: null,
        highlight_description: null,
        score: null,
      } as SearchResult
    })

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* The homepage is OUTSIDE the (main) route group, so the ticker + promo
          popup mounted in (main)/layout don't reach it — mount them here too. */}
      <TickerBar />

      <main className="flex-1 space-y-10 pb-[env(safe-area-inset-bottom,0px)] md:pb-0">
        {/* GeoGate wraps the homepage too. The (main) route group has its own,
            but app/page.tsx sits outside that group, so without this a buyer in
            a disabled zone would see the whole landing page and only hit the
            gate on their next click. */}
        <GeoGate>
          {/* 1. Proposition + the one time-sensitive tile. */}
          <HeroSplit dealCount={dealResults.length} />

          {/* A live campaign still gets the position directly under the hero. */}
          <PromoSlot placement="HERO" className="max-w-page mx-auto px-4 sm:px-5" />

          {/* 2. Destinations. Curated order and artwork, resolved against the
              live tree — never a blind slice of whatever the API returned. */}
          <CategoryRail categories={destinations} />

          {/* 3. The customer picks the lens. Hero and categories stay put above
              it — swapping the entire page on a tap makes the site feel like
              four different sites; varying only the merchandising keeps the
              identity fixed. Panels are server-rendered and all present in the
              DOM, so switching costs no round trip and the content still exists
              without JavaScript. */}
          <HomeViews
            views={[
              { id: "discover", label: "Discover" },
              { id: "deals", label: "Deals" },
              { id: "new", label: "New in" },
              { id: "sellers", label: "Sellers" },
            ]}
            panels={{
              discover: (
                <>
                  <ProductRow
                    title="Today's Deals"
                    badge="Ending soon"
                    products={dealResults}
                    viewAllHref="/search?is_deal=true"
                    viewAllLabel="See all deals"
                  />
                  <ProductRow
                    title="Under $20"
                    products={underTwenty.results ?? []}
                    viewAllHref="/search?max_price=20"
                    viewAllLabel="See everything under $20"
                  />
                  <ForYouRail />
                  <ProductRow
                    title="New Arrivals"
                    products={newArrivals.results ?? []}
                    viewAllHref="/search?sort=newest"
                    viewAllLabel="Explore all new items"
                  />
                  <SellerRail stores={(stores ?? []).slice(0, 8)} />
                </>
              ),
              deals: (
                <>
                  <ProductRow
                    title="Today's Deals"
                    badge="Ending soon"
                    products={dealResults}
                    viewAllHref="/search?is_deal=true"
                    viewAllLabel="See all deals"
                  />
                  <ProductRow
                    title="Under $20"
                    products={underTwenty.results ?? []}
                    viewAllHref="/search?max_price=20"
                    viewAllLabel="See everything under $20"
                  />
                </>
              ),
              new: (
                <ProductRow
                  title="New Arrivals"
                  products={newArrivals.results ?? []}
                  viewAllHref="/search?sort=newest"
                  viewAllLabel="Explore all new items"
                />
              ),
              sellers: <SellerRail stores={(stores ?? []).slice(0, 12)} />,
            }}
          />

          {/* 4. Seller recruitment, kept to one slim strip. */}
          <SellOnAfrotransactStrip />

          {/* 5. Why buy here at all. */}
          <TrustMissionBand />
        </GeoGate>
      </main>

      <PromoSlot placement="FOOTER" className="max-w-page mx-auto px-4 sm:px-5 mb-6" />
      <Footer />
      <PromoPopupModal />
    </div>
  )
}
