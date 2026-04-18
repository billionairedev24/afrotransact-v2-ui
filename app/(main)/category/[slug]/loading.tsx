export default function CategoryLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8">
      <div className="h-5 w-64 rounded bg-muted animate-pulse mb-4" />
      <div className="h-10 w-80 rounded bg-muted animate-pulse mb-8" />
      <div className="grid grid-cols-12 gap-6">
        <aside className="hidden lg:block col-span-3 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              {Array.from({ length: 5 }).map((__, j) => (
                <div
                  key={j}
                  className="h-4 w-full rounded bg-muted animate-pulse"
                />
              ))}
            </div>
          ))}
        </aside>
        <div className="col-span-12 lg:col-span-9">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
