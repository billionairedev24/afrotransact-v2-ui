import Link from "next/link"

/**
 * Split hero: one standing promise, one live merchandising tile.
 *
 * This replaces an auto-advancing carousel whose slides were generated from
 * whichever product photos happened to rank highest. That carousel had two
 * problems worth not repeating. It moved — costing the reader the top of the
 * page on every visit — and its content was an accident of the catalogue rather
 * than anything we chose to say. A hero should state the proposition; it should
 * not be a slideshow of inventory.
 *
 * The right-hand tile is the one genuinely time-sensitive thing on the page, so
 * it earns the position. It self-describes when there are no live deals instead
 * of vanishing, because a hero with a hole in it looks broken in a way a hero
 * with a quieter second panel does not.
 */
export function HeroSplit({ dealCount }: { dealCount: number }) {
  const hasDeals = dealCount > 0

  return (
    <section className="max-w-page mx-auto px-4 sm:px-5">
      <div className="grid gap-3 md:grid-cols-3">
        {/* The promise. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-green to-emerald-900 p-6 text-white md:col-span-2 md:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">
            Vetted sellers · Ships nationwide
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
            Everything you miss,
            <br />
            in one place.
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/85 sm:text-base">
            Groceries, beauty, fashion and home — sourced from sellers who know
            what you are looking for.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-gold-foreground transition hover:bg-brand-gold-hover"
            >
              Start shopping
            </Link>
            <Link
              href="/stores"
              className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Browse sellers
            </Link>
          </div>
        </div>

        {/* The live tile. */}
        <Link
          href={hasDeals ? "/search?is_deal=true" : "/search?sort=newest"}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-brand-gold p-6 text-brand-gold-foreground transition hover:brightness-[0.97]"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
              {hasDeals ? "Today's deals" : "Just landed"}
            </p>
            <p className="mt-3 font-display text-2xl leading-tight md:text-3xl">
              {hasDeals
                ? `${dealCount} ${dealCount === 1 ? "deal" : "deals"} ending soon`
                : "New arrivals this week"}
            </p>
          </div>
          <span className="mt-6 text-sm font-semibold underline-offset-4 group-hover:underline">
            {hasDeals ? "See all deals" : "See what's new"} →
          </span>
        </Link>
      </div>
    </section>
  )
}
