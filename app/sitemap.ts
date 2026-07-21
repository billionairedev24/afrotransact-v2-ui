import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { getAllStores, getCategories, getStoreProducts } from "@/lib/api"

// Regenerate at most hourly. Product/store/category data is fetched server-side
// from the API; every fetch is wrapped so a transient API hiccup degrades to a
// smaller sitemap rather than a 500.
export const revalidate = 3600

// Safety caps so a single generation always finishes inside the function's
// time budget even if the catalog grows unexpectedly.
const MAX_PAGES_PER_STORE = 10 // × 100 = up to 1,000 products/store
const PRODUCT_PAGE_SIZE = 100

const now = new Date()

function entry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap[number] {
  return { url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static hubs (marketing, browse, legal) ──
  const staticEntries: MetadataRoute.Sitemap = [
    entry("", "daily", 1.0),
    entry("/search", "daily", 0.7),
    entry("/categories", "weekly", 0.7),
    entry("/stores", "weekly", 0.7),
    entry("/deals", "daily", 0.8),
    entry("/about", "monthly", 0.4),
    entry("/help", "monthly", 0.4),
    entry("/sell", "monthly", 0.5),
    entry("/referral", "monthly", 0.3),
    entry("/refund-policy", "yearly", 0.3),
    entry("/terms", "yearly", 0.3),
    entry("/privacy", "yearly", 0.3),
    entry("/seller-agreement", "yearly", 0.3),
  ]

  // ── Categories ──
  const categoryEntries: MetadataRoute.Sitemap = []
  try {
    const cats = await getCategories({ revalidate })
    const seen = new Set<string>()
    const walk = (list: typeof cats) => {
      for (const c of list ?? []) {
        if (c.slug && !seen.has(c.slug)) {
          seen.add(c.slug)
          categoryEntries.push(entry(`/category/${c.slug}`, "weekly", 0.6))
        }
        if (c.children?.length) walk(c.children)
      }
    }
    walk(cats)
  } catch {
    /* skip categories on failure */
  }

  // ── Stores + their products ──
  const storeEntries: MetadataRoute.Sitemap = []
  const productSlugs = new Set<string>()
  try {
    const stores = await getAllStores({ revalidate })
    for (const store of stores ?? []) {
      if (store.slug) storeEntries.push(entry(`/store/${store.slug}`, "weekly", 0.6))
      try {
        for (let page = 0; page < MAX_PAGES_PER_STORE; page++) {
          const res = await getStoreProducts(store.id, page, PRODUCT_PAGE_SIZE)
          for (const p of res.content ?? []) {
            if (p.slug) productSlugs.add(p.slug)
          }
          if (page + 1 >= (res.totalPages ?? 1)) break
        }
      } catch {
        /* skip this store's products on failure */
      }
    }
  } catch {
    /* skip stores on failure */
  }

  const productEntries: MetadataRoute.Sitemap = Array.from(productSlugs).map((slug) =>
    entry(`/product/${slug}`, "weekly", 0.8),
  )

  return [...staticEntries, ...categoryEntries, ...storeEntries, ...productEntries]
}
