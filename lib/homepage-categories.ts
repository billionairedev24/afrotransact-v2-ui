/**
 * Curated homepage category destinations.
 *
 * The homepage used to take `categories.filter(root).slice(0, 4)` — the first
 * four roots in whatever order the backend happened to return. That is how a
 * production catalogue whose taxonomy had drifted ended up advertising "Garri"
 * as a top-level destination while Health & Beauty was silently cut off the
 * end. The page was rendering correct code over bad data, and had no opinion of
 * its own to fall back on.
 *
 * So this file is the opinion. It fixes ORDER and ARTWORK for the destinations
 * we actually want to sell, and the live API decides what EXISTS. Neither side
 * can wreck the page alone:
 *
 *   - a curated entry with no matching live category is dropped (we never link
 *     somewhere that 404s)
 *   - a live root category we have not curated is still appended, so a new
 *     category can never be silently invisible the way it was before
 *
 * Matching is by slug. Keep these slugs in step with `catalog.categories`.
 */

export interface CuratedCategory {
  /** Must match a `catalog.categories.slug` to be rendered. */
  slug: string
  /** Shown under the circle. Overrides the catalog name when they differ. */
  label: string
  /** Tailwind gradient used when the category has no product imagery yet. */
  tone: string
}

/**
 * Order here is the order on the page. Grocery leads because it is where the
 * catalogue actually has depth today — but it leads as ONE destination among
 * five, not as four of the first four.
 */
export const CURATED_CATEGORIES: CuratedCategory[] = [
  { slug: "food-grocery", label: "Grocery", tone: "from-emerald-700 to-emerald-900" },
  { slug: "health-beauty", label: "Beauty", tone: "from-amber-600 to-amber-800" },
  { slug: "fashion", label: "Fashion", tone: "from-rose-700 to-rose-900" },
  { slug: "home-garden", label: "Home", tone: "from-slate-600 to-slate-800" },
  { slug: "electronics", label: "Electronics", tone: "from-violet-700 to-violet-900" },
]

/** A curated entry resolved against the live category tree. */
export interface ResolvedCategory {
  id: string
  slug: string
  label: string
  tone: string
  href: string
  /** A representative product image, when the catalogue has one. */
  imageUrl: string | null
}

const FALLBACK_TONES = [
  "from-teal-700 to-teal-900",
  "from-orange-600 to-orange-800",
  "from-indigo-700 to-indigo-900",
  "from-lime-700 to-lime-900",
]

interface LiveCategory {
  id: string
  name: string
  slug: string
  parentId?: string | null
}

/**
 * Resolves the curated list against the live root categories.
 *
 * Deliberately returns EVERY live root — curated ones first in curated order,
 * then anything uncurated. There is no slice. If the page ever needs to cap the
 * count, cap it here with a comment saying why, so the next person can see the
 * decision instead of inheriting a silent truncation.
 */
export function resolveHomepageCategories(
  live: LiveCategory[],
  imageByCategoryId: Record<string, string | null> = {},
): ResolvedCategory[] {
  const roots = live.filter((c) => c.parentId == null && c.slug !== "services")
  const bySlug = new Map(roots.map((c) => [c.slug, c]))
  const used = new Set<string>()

  const curated: ResolvedCategory[] = []
  for (const entry of CURATED_CATEGORIES) {
    const match = bySlug.get(entry.slug)
    if (!match) continue // curated but not in the catalogue — don't link to a 404
    used.add(match.slug)
    curated.push({
      id: match.id,
      slug: match.slug,
      label: entry.label,
      tone: entry.tone,
      href: `/category/${match.slug}`,
      imageUrl: imageByCategoryId[match.id] ?? null,
    })
  }

  const uncurated: ResolvedCategory[] = roots
    .filter((c) => !used.has(c.slug))
    .map((c, i) => ({
      id: c.id,
      slug: c.slug,
      label: c.name,
      tone: FALLBACK_TONES[i % FALLBACK_TONES.length],
      href: `/category/${c.slug}`,
      imageUrl: imageByCategoryId[c.id] ?? null,
    }))

  return [...curated, ...uncurated]
}
