export default function DealsLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="h-10 w-72 rounded bg-muted animate-pulse mb-8" />
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
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 rounded bg-muted animate-pulse" />
                <div className="h-5 w-10 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
