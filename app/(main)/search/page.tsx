import type { Metadata } from "next"
import { getCategories, searchProducts, type CategoryRef, type SearchResponse } from "@/lib/api"
import { features } from "@/lib/features"
import SearchPageClient from "./SearchPageClient"
import { isRouterNavigation } from "@/lib/rsc"
import { buildSearchParams, searchParamsKey } from "./seed"

type Query = Record<string, string | string[] | undefined>

export const metadata: Metadata = {
  title: "Search | AfroTransact",
  description: "Search products from vetted African-owned sellers on AfroTransact.",
}

function first(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v
  return s ?? ""
}

/** Server shell for /search: renders the first result set into the HTML so the
 *  page doesn't start with a client fetch waterfall. The client owns every
 *  interaction (filters, sort, paging, mobile drawer) exactly as before — it
 *  simply skips its mount fetch when its params match `initialParamsKey`.
 *
 *  Seeding is deliberately conservative: a buyer with a saved Deliver-to
 *  location sends lat/lon the server can't know, so that request's key won't
 *  match and the client fetches, which is today's behavior. Kill-switch:
 *  NEXT_PUBLIC_FEATURE_SEARCH_SSR=false. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  if (
    !features.searchSsrEnabled() ||
    !features.marketplaceEnabled() ||
    (await isRouterNavigation())
  ) {
    return <SearchPageClient />
  }

  // A URL that already carries geo is seedable — those params are in the URL,
  // so the server can reproduce the client's request exactly.
  const urlLat = first(query.lat)
  const urlLon = first(query.lon)
  const urlRadius = first(query.radius)
  const numericRadius = urlRadius && urlRadius !== "all" && urlRadius !== "any" ? urlRadius : null

  let categories: CategoryRef[] = []
  try {
    categories = (await getCategories({ revalidate: 300 })).filter(
      (c) => !c.parentId && c.slug !== "services",
    )
  } catch {
    categories = []
  }

  const params = buildSearchParams({
    query: first(query.q),
    category: first(query.category),
    sortBy: first(query.sort) || "relevance",
    minPrice: first(query.min_price),
    maxPrice: first(query.max_price),
    minRating: first(query.min_rating),
    page: Math.max(1, parseInt(first(query.page) || "1", 10)),
    categoryList: categories,
    lat: urlLat ? parseFloat(urlLat) : null,
    lon: urlLon ? parseFloat(urlLon) : null,
    radius: numericRadius,
  })

  let data: SearchResponse | null = null
  try {
    data = await searchProducts(params, { revalidate: 60 })
  } catch {
    // Seeding is an optimization — let the client fetch and own the error UI.
    data = null
  }

  return (
    <SearchPageClient
      initialData={data}
      initialCategories={categories.length ? categories : null}
      initialParamsKey={data ? searchParamsKey(params) : null}
    />
  )
}
