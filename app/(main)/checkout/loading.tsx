export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10">
      <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6 space-y-4"
            >
              <div className="h-6 w-48 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded bg-muted animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 rounded bg-muted animate-pulse" />
                <div className="h-10 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-3 h-fit">
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            </div>
          ))}
          <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}
