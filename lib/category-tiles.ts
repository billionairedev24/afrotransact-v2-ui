/**
 * Server-side pre-computation of category "tile" images for the homepage
 * `CategoryShowcaseAmazon` block.
 *
 * The old approach fetched images per-parent, per-slot from the client:
 *   N parents × (4 child slots + 1 parent pool) = N × 5 concurrent
 *   `/api/v1/search?category=…` calls on every page load.
 *
 * That reliably tripped the gateway's sensitive-endpoint rate limiter (HTTP
 * 429). The new approach:
 *
 *   1. Server (inside app/page.tsx) makes ONE `/api/v1/search?size=96` call.
 *   2. We bucket results by their `categories` field (each SearchResult
 *      carries the list of category names it belongs to).
 *   3. For every parent category visible in the UI, we pick up to 4 tiles
 *      by preferring child-category matches, then falling back to the
 *      parent's pool.
 *   4. Result is passed as `initialTiles` to the client component, which
 *      renders it synchronously — no `useEffect`, no client fetch, no
 *      rate-limit risk.
 *
 * The upstream `searchProducts` call is cached by Next.js (`revalidate: 300`),
 * so across the entire fleet this function causes at most ~1 gateway call
 * every 5 minutes, regardless of user traffic.
 */

import { searchProducts, type CategoryRef, type SearchResult } from "@/lib/api"

export type TilePick = {
  image: string
  slug: string | null
  productId: string
}

/** Map keyed by parent category id → 4 tiles (some may be null). */
export type TilesByParentId = Record<string, (TilePick | null)[]>

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

function toTile(r: SearchResult): TilePick | null {
  if (!r.image_url) return null
  return {
    image: r.image_url,
    slug: r.slug ?? null,
    productId: r.product_id,
  }
}

/**
 * Produce tile data for each given parent category, using a single shared
 * pool of search results.
 *
 * @param parents      Top-level categories to build tiles for.
 * @param poolResults  A single batched search response (ideally `size=96+`).
 *                     Typically `results` from `searchProducts({ size: "96" })`.
 */
export function buildTilesFromPool(
  parents: CategoryRef[],
  poolResults: SearchResult[],
): TilesByParentId {
  if (parents.length === 0 || poolResults.length === 0) return {}

  // Pre-index results by normalized category name for O(1) lookups per tile slot.
  const byCategory = new Map<string, SearchResult[]>()
  for (const r of poolResults) {
    if (!r.image_url) continue
    for (const cat of r.categories ?? []) {
      const key = normalize(cat)
      const bucket = byCategory.get(key)
      if (bucket) bucket.push(r)
      else byCategory.set(key, [r])
    }
  }

  const result: TilesByParentId = {}
  const usedGlobal = new Set<string>() // product_ids already placed, avoid repeats across tiles

  for (const parent of parents) {
    const children = (parent.children ?? []).slice(0, 4)
    const parentPool = byCategory.get(normalize(parent.name)) ?? []
    const tiles: (TilePick | null)[] = []

    for (let i = 0; i < 4; i++) {
      const childName = children[i]?.name ?? parent.name
      const candidates = byCategory.get(normalize(childName)) ?? parentPool

      // Prefer an unused product, so tiles within one card don't duplicate.
      const pick =
        candidates.find((r) => !usedGlobal.has(r.product_id)) ?? candidates[0] ?? null
      const tile = pick ? toTile(pick) : null
      if (pick) usedGlobal.add(pick.product_id)
      tiles.push(tile)
    }

    result[parent.id] = tiles
  }

  return result
}

/**
 * Convenience wrapper: fetch the search pool AND bucket in one call.
 * Safe to invoke from Server Components; relies on Next.js's fetch cache
 * for deduplication/revalidation.
 */
export async function fetchCategoryTiles(
  parents: CategoryRef[],
  opts: { revalidate?: number; size?: number } = {},
): Promise<TilesByParentId> {
  if (parents.length === 0) return {}
  const size = String(opts.size ?? 96)
  const revalidate = opts.revalidate ?? 300

  try {
    const res = await searchProducts({ size }, { revalidate })
    return buildTilesFromPool(parents, res.results ?? [])
  } catch {
    // Degrade gracefully — client renders empty tiles, not a broken page.
    return {}
  }
}
