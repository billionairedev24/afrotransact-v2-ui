import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCatalogItemBuyBoxBySlug, type CatalogItemBuyBox } from "@/lib/api"
import { BuyBoxClient } from "./BuyBoxClient"

/**
 * Phase 9.6 buyer-side PDP — reads catalog item + Buy Box from the new
 * /api/v1/catalog/items/by-slug/{slug}/with-offers endpoint. Renders one
 * master listing per catalog item with the winning offer featured and an
 * "Other sellers" panel below.
 *
 * This route is the START of the Amazon-style flip. The legacy
 * /product/[slug] route keeps working through Phase 9.7 cleanup so
 * existing bookmarks don't 404.
 *
 * ISR: catalog item content rarely changes; offer prices/stock change
 * more often. 30s revalidate trades freshness for cost.
 */
export const revalidate = 30

type Params = { slug: string }

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params
  try {
    const item = await getCatalogItemBuyBoxBySlug(slug, { revalidate: 30 })
    const primary = item.images.find((i) => i.isPrimary) ?? item.images[0]
    return {
      title: `${item.title} | AfroTransact`,
      description: item.description?.slice(0, 160) ?? item.title,
      openGraph: {
        title: item.title,
        description: item.description?.slice(0, 200) ?? item.title,
        images: primary ? [{ url: primary.url }] : undefined,
        type: "website",
      },
    }
  } catch {
    return { title: "Product not found | AfroTransact" }
  }
}

export default async function CatalogPDP({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  let item: CatalogItemBuyBox
  try {
    item = await getCatalogItemBuyBoxBySlug(slug, { revalidate: 30 })
  } catch {
    notFound()
  }

  const primary = item.images.find((i) => i.isPrimary) ?? item.images[0]
  const highlights = parseHighlights(item.highlights)

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8">
        {/* Gallery */}
        <section className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
            {primary ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={primary.url} alt={primary.altText ?? item.title} className="h-full w-full object-cover" />
            ) : null}
          </div>
          {item.images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {item.images.map((img) => (
                <div key={img.id} className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.altText ?? ""} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right column: title, buy-box, other sellers */}
        <section className="space-y-6">
          <header>
            {item.brand && (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.brand}</p>
            )}
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{item.title}</h1>
            <p className="mt-1 text-[11px] font-mono text-muted-foreground">{item.itemNumber}</p>
          </header>

          <BuyBoxClient item={item} primaryImageUrl={primary?.url ?? null} />

          {item.description && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">About this product</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
            </section>
          )}

          {highlights.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">Highlights</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                {highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </section>
          )}
        </section>
      </div>
    </main>
  )
}

function parseHighlights(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
