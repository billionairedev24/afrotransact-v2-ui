import type { CategoryRef, SearchResponse } from "@/lib/api"

/** Server-rendered seed handed to the search client for the first paint.
 *  Shared by the server shell (`page.tsx`) and the client so both build the
 *  search request the same way — a mismatch just means the client refetches,
 *  never a wrong result set. */
export interface SearchSeed {
  initialData?: SearchResponse | null
  initialCategories?: CategoryRef[] | null
  /** Canonical key of the request `initialData` came from; the client skips
   *  its mount fetch only when its own params produce this exact key. */
  initialParamsKey?: string | null
}

export const SEARCH_PAGE_SIZE = 12

export interface SearchParamInput {
  query?: string
  category?: string
  sortBy?: string
  minPrice?: string
  maxPrice?: string
  minRating?: string
  page?: number
  /** Resolved category tree — used to send the display name for documents
   *  indexed before `category_slugs` existed. */
  categoryList?: CategoryRef[]
  lat?: number | null
  lon?: number | null
  /** Only a buyer-chosen numeric radius; "all"/"any" mean no radius filter. */
  radius?: string | null
}

/** Build the search-service query params. Single source of truth so the SSR
 *  seed and the client request can be compared byte-for-byte. */
export function buildSearchParams(input: SearchParamInput): Record<string, string> {
  const {
    query = "",
    category = "",
    sortBy = "relevance",
    minPrice = "",
    maxPrice = "",
    minRating = "",
    page = 1,
    categoryList = [],
    lat = null,
    lon = null,
    radius = null,
  } = input

  const params: Record<string, string> = {
    page: String(page),
    size: String(SEARCH_PAGE_SIZE),
    sort_by: sortBy,
  }
  if (query) params.q = query
  if (category) {
    // The URL keeps a clean slug, but ES historically indexed only the
    // lowercased name on `categories` (the `category_slugs` field is only
    // populated for documents indexed after that change shipped). Sending
    // the name when we can resolve it lets older documents match while the
    // backend's OR-filter still catches new ones via the slug field.
    const matched = categoryList.find((c) => c.slug === category)
    params.category = matched ? matched.name.toLowerCase() : category
  }
  if (minPrice) params.min_price = minPrice
  if (maxPrice) params.max_price = maxPrice
  if (minRating) params.min_rating = minRating
  if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
    // ES service uses `lon` (not `lng`); the buyer-location store uses `lng`.
    params.lat = String(lat)
    params.lon = String(lon)
    // Omitting `radius` triggers the backend's "all supported areas,
    // closest-first" behavior and lets it flag beyond_ship_limit results.
    if (radius) params.radius = radius
  }
  return params
}

/** Order-independent canonical string for a params map. */
export function searchParamsKey(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
}
