import Image from "next/image"
import Link from "next/link"
import type { ResolvedCategory } from "@/lib/homepage-categories"

/**
 * Horizontal rail of category destinations.
 *
 * Chosen over the previous bento grid of four large tiles for one reason: it
 * scales. Four tiles look deliberate at four categories and broken at nine —
 * whereas a rail reads correctly anywhere from five to fifteen without a
 * redesign, which is the range this catalogue will move through as sellers
 * onboard. It also costs far less vertical space above the fold, so the first
 * product row is visible on a phone without scrolling.
 *
 * Each circle shows a real product photograph when the category has one, and
 * falls back to a brand gradient when it does not. That fallback is the point:
 * a category with no inventory yet still looks intentional rather than empty,
 * which is what lets us merchandise breadth before the catalogue has it.
 */
export function CategoryRail({ categories }: { categories: ResolvedCategory[] }) {
  if (categories.length === 0) return null

  return (
    <section className="max-w-page mx-auto px-4 sm:px-5">
      <h2 className="sr-only">Shop by category</h2>

      {/* Scrolls on narrow screens, centres once everything fits. Uses the
          project's existing `scrollbar-hide` utility (app/globals.css) so the
          rail matches ProductRow's carousel rather than inventing a second
          way to hide a scrollbar. */}
      <ul
        className="flex gap-5 overflow-x-auto scrollbar-hide py-1 sm:justify-center"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((c) => (
          <li key={c.id} className="shrink-0">
            <Link
              href={c.href}
              className="group flex w-20 flex-col items-center gap-2 sm:w-24"
            >
              <span
                className={`relative grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${c.tone} ring-1 ring-black/5 transition group-hover:scale-105 group-focus-visible:scale-105 sm:h-20 sm:w-20`}
              >
                {c.imageUrl ? (
                  <Image
                    src={c.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  // No photography yet — the gradient carries it, and the
                  // initial keeps the circle from reading as a loading state.
                  <span className="font-display text-xl text-white/90">
                    {c.label.charAt(0)}
                  </span>
                )}
              </span>
              <span className="text-center text-xs font-medium leading-tight text-foreground sm:text-sm">
                {c.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
