import Image from "next/image"
import Link from "next/link"
import type { StoreInfo } from "@/lib/api"

/**
 * "Shop by seller" rail.
 *
 * The homepage previously had no seller surface at all — the only route to a
 * storefront was a single button in the hero. For a marketplace whose whole
 * proposition is *who* it buys from, that buried the differentiator: on a
 * page of anonymous product tiles there is nothing to distinguish us from any
 * other catalogue. Sellers are the thing Amazon flattens away, so they get a
 * row of their own.
 *
 * Deliberately shows the city. "Manupa, Austin" is a different promise from a
 * faceless warehouse, and proximity is what makes same-city pickup legible.
 */
export function SellerRail({ stores }: { stores: StoreInfo[] }) {
  if (stores.length === 0) return null

  return (
    <section className="max-w-page mx-auto px-4 sm:px-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">Shop by seller</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Independent sellers, vetted before they list.
          </p>
        </div>
        <Link
          href="/stores"
          className="shrink-0 text-sm font-semibold text-brand-green underline-offset-4 hover:underline"
        >
          Browse all sellers →
        </Link>
      </div>

      <ul
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {stores.map((s) => {
          const city = [s.addressCity, s.addressState].filter(Boolean).join(", ")
          return (
            <li key={s.id} className="w-56 shrink-0 sm:w-64">
              <Link
                href={`/store/${s.slug}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition hover:border-brand-green/40 hover:shadow-sm"
              >
                <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-sand ring-1 ring-black/5">
                  {s.logoUrl ? (
                    <Image src={s.logoUrl} alt="" fill className="object-cover" sizes="48px" />
                  ) : (
                    // No logo uploaded yet — an initial reads as intentional
                    // where an empty circle reads as a failed image.
                    <span className="font-display text-lg text-sand-foreground">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="mt-3 line-clamp-1 font-medium text-foreground group-hover:text-brand-green">
                  {s.name}
                </span>

                <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {city}
                  {city && s.reviewCount > 0 ? " · " : ""}
                  {s.reviewCount > 0 && (
                    <>
                      {s.rating.toFixed(1)}★ ({s.reviewCount})
                    </>
                  )}
                </span>

                {s.description && (
                  <span className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {s.description}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
