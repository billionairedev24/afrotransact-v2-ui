export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header placeholder (real header mounts via page) */}
      <div className="h-14 border-b border-border bg-card/60" />

      <main className="flex-1 space-y-10 pb-12">
        {/* Hero — woven band, matches components/landing/Hero.tsx */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-woven-strong">
            <div className="absolute inset-0 bg-gradient-to-r from-sand/95 via-sand/80 to-sand/40 dark:from-background/95 dark:via-background/85 dark:to-background/50" />
            <div className="relative px-6 py-10 sm:px-10 sm:py-14 max-w-xl space-y-5">
              <div className="h-7 w-44 rounded-full bg-card/70 animate-pulse" />
              <div className="h-12 w-3/4 rounded-lg bg-card/70 animate-pulse" />
              <div className="h-12 w-2/3 rounded-lg bg-card/70 animate-pulse" />
              <div className="h-5 w-1/2 rounded bg-card/60 animate-pulse" />
              <div className="flex gap-3 pt-2">
                <div className="h-12 w-40 rounded-full bg-card/70 animate-pulse" />
                <div className="h-12 w-36 rounded-full bg-card/60 animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* Category bento — 4 cards */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <div className="h-6 w-2/3 rounded bg-muted animate-pulse mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="aspect-square rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Product rows — two carousels */}
        {Array.from({ length: 2 }).map((_, r) => (
          <section key={r} className="max-w-[1440px] mx-auto px-4 sm:px-5">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="h-7 w-56 rounded bg-muted animate-pulse mb-6" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="min-w-[240px] max-w-[240px] space-y-2">
                    <div className="aspect-square rounded-lg bg-muted animate-pulse" />
                    <div className="h-4 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                    <div className="h-8 rounded-full bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
