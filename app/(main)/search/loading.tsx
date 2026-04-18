export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-64 rounded bg-muted animate-pulse" />
        <div className="h-10 w-40 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="aspect-square bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
