export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10">
      <div className="h-8 w-40 rounded bg-muted animate-pulse mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-48 rounded bg-muted animate-pulse" />
              <div className="h-5 w-24 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-4 w-64 rounded bg-muted animate-pulse" />
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((__, j) => (
                <div
                  key={j}
                  className="h-16 w-16 rounded-lg bg-muted animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
