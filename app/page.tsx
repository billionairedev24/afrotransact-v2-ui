import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PromoSlot } from "@/components/marketing/PromoSlot"
import { GeoGate } from "@/components/geo/GeoGate"
// REPLACED BY <CategoriesBentoGrid> + <TrustMissionBand>: kept commented for
// quick revert if there's a visual regression.
// import { FeaturedProducts } from "@/components/home/FeaturedProducts"
// import { CategoryShowcaseAmazon } from "@/components/categories/CategoryShowcaseAmazon"
// import { FeaturedCategories } from "@/components/landing/FeaturedCategories"
// import { ForYouSection } from "@/components/home/ForYouSection"
import { ForYouRail } from "@/components/orders/ForYouRail"
import { HeroCarousel } from "@/components/landing/HeroCarousel"
import { CategoriesBentoGrid } from "@/components/landing/CategoriesBentoGrid"
import { TrustMissionBand } from "@/components/landing/TrustMissionBand"
import { ProductRow } from "@/components/landing/ProductRow"
import { SellOnAfrotransactStrip } from "@/components/landing/SellOnAfrotransactStrip"
import { fetchCategoryTiles } from "@/lib/category-tiles"
import {
  getCategories,
  getFeaturedDeals,
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
          // Real stock from the deal's linked product (enrichWithProduct).
          // Fail safe: an unknown/absent flag renders as out-of-stock rather
          // than a live Add-to-Cart button on a sold-out item.
          in_stock: d.inStock ?? false,
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
  // on both name and slug). Products are only ever tagged with their leaf
  // sub-category, so a parent card like "Grocery" must borrow images from
  // its children — otherwise it renders empty.
  //
  // GET /api/v1/categories returns a NESTED tree: sub-categories live under
  // `.children`, never as flat top-level entries. We therefore recurse the
  // tree. (A flat `parentId` scan finds nothing here, which is exactly why
  // the "Grocery" parent showed no thumbnails.)
  function collectDescendantTokens(root: CategoryRef): Set<string> {
    const tokens = new Set<string>()
    const walk = (node: CategoryRef) => {
      tokens.add(node.name.toLowerCase())
      tokens.add(node.slug.toLowerCase())
      for (const child of node.children ?? []) walk(child)
    }
    walk(root)
    return tokens
  }
  // Up to 4 product images per root card — pulled from any descendant of
  // the root, no sub-category labels. Pure product tiles: image only,
  // click goes to the product. Shuffled per request so a sparse catalog
  // doesn't look frozen.
  type BentoTile = {
    label: string
    categorySlug: string
    image: string | null
    productSlug?: string
  }
  function shuffled<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const tilesByRoot: Record<string, BentoTile[]> = {}
  for (const cat of roots) {
    const tokens = collectDescendantTokens(cat)
    const pool = featuredRating.results
      .filter((p) => p.image_url)
      .filter((p) => p.categories?.some((c) => tokens.has(c.toLowerCase())))
    tilesByRoot[cat.id] = shuffled(pool).slice(0, 4).map((p) => ({
      label: p.title,
      categorySlug: cat.slug,
      image: p.image_url,
      productSlug: p.slug,
    }))
  }

  // Build the hero carousel from REAL data: a brand slide on the woven motif,
  // then one slide per root category that actually has product imagery — each
  // links to its real /category/{slug} page and uses a real product photo. The
  // carousel shuffles these client-side so the order varies per visit.
  function catCopy(name: string): { title: string; sub: string } {
    const n = name.toLowerCase()
    if (n.includes("food") || n.includes("grocer"))
      return { title: "Fresh groceries & pantry staples, sorted.", sub: "Rice, flours, spices and the everyday essentials — delivered close to you." }
    if (n.includes("beauty") || n.includes("health") || n.includes("hair"))
      return { title: "Beauty & care, curated for you.", sub: "Skincare, hair and wellness picks from brands you trust." }
    if (n.includes("fashion") || n.includes("cloth") || n.includes("apparel"))
      return { title: "Style that tells your story.", sub: "Fabrics, fits and finds for every occasion." }
    if (n.includes("home") || n.includes("garden") || n.includes("kitchen"))
      return { title: "Make every room feel like home.", sub: "Cookware, decor and homeware to bring the culture indoors." }
    if (n.includes("electronic") || n.includes("gadget") || n.includes("tech"))
      return { title: "Gadgets & essentials for every home.", sub: "Reliable everyday tech, ready to ship." }
    return { title: `Explore ${name}.`, sub: `Curated ${n} picks — delivered close to you.` }
  }
  const heroSlides = [
    {
      id: "brand",
      eyebrow: "Your community market",
      title: "African & diaspora treasures, from your neighborhood.",
      sub: "Fresh groceries, spices, beauty, and homeware — curated for the diaspora and delivered close to you.",
      cta: { label: "Shop today’s deals", href: "/search?is_deal=true" },
    },
    ...roots
      .map((cat) => ({ cat, image: tilesByRoot[cat.id]?.find((t) => t.image)?.image ?? undefined }))
      .filter((x): x is { cat: typeof roots[number]; image: string } => Boolean(x.image))
      .map(({ cat, image }) => {
        const copy = catCopy(cat.name)
        return {
          id: `cat-${cat.slug}`,
          eyebrow: cat.name,
          title: copy.title,
          sub: copy.sub,
          cta: { label: `Shop ${cat.name}`, href: `/category/${cat.slug}` },
          image,
        }
      }),
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pb-[env(safe-area-inset-bottom,0px)] md:pb-0 space-y-10">
        {/* GeoGate wraps the homepage too. The (main) route group has its
            own GeoGate, but app/page.tsx is OUTSIDE that group so without
            this wrapper a buyer in a disabled / not_serviced zone would
            still see the full landing page and only hit the gate after
            clicking into Cart or another (main) route. */}
        <GeoGate>
        {/* 1. Editorial hero carousel — several auto-advancing banners (brand
            thesis + photographic slides). Always renders, so the homepage is
            never an empty void. A live campaign still shows via PromoSlot. */}
        <HeroCarousel slides={heroSlides} />
        <PromoSlot placement="HERO" className="max-w-page mx-auto px-4 sm:px-5 mt-4" />

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

        {/* 3.5 Buy It Again — Amazon-style positioning: nestled after the
            primary deals surface, alongside other content rows, so it reads
            as a personalized recommendation rather than a top-of-page banner.
            Self-hides for guests + buyers with <4 eligible items. */}
        <ForYouRail />

        {/* 4. Slim mid-page seller CTA */}
        <SellOnAfrotransactStrip />

        {/* 5. Trust & Mission Band */}
        <TrustMissionBand />

        {/* 6. New Arrivals */}
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
        </GeoGate>

      </main>

      {/* Removed the auto-popping seller modal from the buyer homepage: the
          buyer surface already carries an AI pill, WhatsApp FAB, and the
          <SellOnAfrotransactStrip> as the single seller entry point. An
          interstitial that sells to sellers on top of that spends buyer
          attention against the page's actual job. */}

      <PromoSlot placement="FOOTER" className="max-w-page mx-auto px-4 sm:px-5 mb-6" />
      <Footer />
    </div>
  )
}
