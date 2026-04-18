export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8">
      <div className="h-48 w-full rounded-xl bg-muted animate-pulse mb-6" />
      <div className="flex items-end gap-4 mb-8">
        <div className="h-24 w-24 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
        </div>
      </div>
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
  )
}
