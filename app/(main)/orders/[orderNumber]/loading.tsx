export default function OrderDetailLoading() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 sm:px-6 py-10">
      <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
      <div className="h-8 w-64 rounded bg-muted animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6 space-y-4"
            >
              <div className="h-6 w-40 rounded bg-muted animate-pulse" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="flex gap-4">
                  <div className="h-16 w-16 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-3 h-fit">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
