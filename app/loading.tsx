export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header placeholder (real header mounts via page) */}
      <div className="h-14 border-b border-border bg-card/60" />

      <main className="flex-1">
        {/* Hero */}
        <div className="relative overflow-hidden min-h-[480px] bg-gradient-to-br from-muted to-card">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-16 md:py-24 w-full">
            <div className="max-w-2xl space-y-5">
              <div className="h-6 w-40 rounded-full bg-muted animate-pulse" />
              <div className="h-12 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-6 w-1/2 rounded bg-muted animate-pulse" />
              <div className="h-12 w-48 rounded-xl bg-muted animate-pulse" />
            </div>
          </div>
        </div>

        {/* Deals strip */}
        <div className="bg-card/70 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-3 flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-32 rounded bg-muted animate-pulse" />
            ))}
          </div>
        </div>

        {/* Category showcase */}
        <div className="bg-[#eaeded] border-y border-gray-200">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10 sm:py-12">
            <div className="h-6 w-48 rounded bg-gray-200 animate-pulse mb-5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="h-5 bg-gray-100 rounded w-2/3 mb-3 animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <div key={j} className="aspect-square bg-gray-100 rounded-md animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product grid */}
        <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
          <div className="h-7 w-64 rounded bg-muted animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl sm:rounded-2xl border border-border bg-card overflow-hidden"
              >
                <div className="h-[120px] sm:aspect-square bg-muted animate-pulse" />
                <div className="p-2 sm:p-3 space-y-2">
                  <div className="h-4 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-8 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
