import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCategories, searchProducts, type CategoryRef, type SearchResult } from "@/lib/api"
import { isRouterNavigation } from "@/lib/rsc"
import CategoryPageClient from "./CategoryPageClient"

// Categories barely change; ISR for 5 minutes means almost all traffic
// is served from the Next.js cache while still picking up edits quickly.
export const revalidate = 300

type Params = { slug: string }
type Query = Record<string, string | string[] | undefined>

const PAGE_SIZE = 24

function findCategoryNode(list: CategoryRef[], slug: string): CategoryRef | null {
  for (const c of list) {
    if (c.slug === slug) return c
    if (c.children) {
      const found = findCategoryNode(c.children, slug)
      if (found) return found
    }
  }
  return null
}

/** A category's own slug plus every descendant slug — products are tagged with
 *  their leaf category, so a parent must query all of its children. Mirrors the
 *  client helper of the same name. */
function collectCategorySlugs(node: CategoryRef): string[] {
  const out: string[] = []
  const walk = (n: CategoryRef) => {
    out.push(n.slug)
    for (const child of n.children ?? []) walk(child)
  }
  walk(node)
  return out
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  try {
    const categories = await getCategories({ revalidate: 300 })
    const name = findCategoryNode(categories, slug)?.name ?? slug
    const title = `${name} | AfroTransact`
    const description = `Browse ${name} products from vetted African-owned sellers on AfroTransact.`
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary", title, description },
      alternates: { canonical: `/category/${slug}` },
    }
  } catch {
    return { title: "Category | AfroTransact" }
  }
}

function first(v: string | string[] | undefined): string | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Query>
}) {
  const { slug } = await params
  const query = await searchParams
  // Validate the slug server-side so an unknown category returns a real 404
  // instead of a soft-404 (empty client render served with a 200). On a
  // transient API error we don't 404 a possibly-valid page.
  let node: CategoryRef | null = null
  let resolved = false
  try {
    const categories = await getCategories({ revalidate: 300 })
    node = findCategoryNode(categories, slug)
    resolved = true
  } catch {
    resolved = false
  }
  if (resolved && !node) notFound()

  // SSR the first page of products so the grid is in the initial HTML instead
  // of arriving after a client mount waterfall. Only the plain first page is
  // seeded — a `?featured_id=` or `?page=2` view keeps the client fetch, which
  // is exactly the path the client already runs for every other param change.
  const page = first(query.page)
  const featuredId = first(query.featured_id) ?? first(query.featured)
  // A client-side router navigation is not worth seeding: the mounted client
  // has already started its own fetch by the time this render lands.
  const seedable = (!page || page === "1") && !featuredId && !(await isRouterNavigation())

  let initialProducts: SearchResult[] | null = null
  let initialTotal = 0
  const querySlugs = node ? collectCategorySlugs(node) : null
  if (seedable && querySlugs) {
    try {
      const res = await searchProducts(
        { category: querySlugs.join(","), size: String(PAGE_SIZE), page: "1" },
        { revalidate: 300 },
      )
      initialProducts = res.results
      initialTotal = res.total
    } catch {
      // Seeding is an optimization — fall through and let the client fetch.
      initialProducts = null
    }
  }

  return (
    <CategoryPageClient
      initialName={node?.name ?? null}
      initialQuerySlugs={querySlugs}
      initialProducts={initialProducts}
      initialTotal={initialTotal}
    />
  )
}
