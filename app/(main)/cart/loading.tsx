export default function CartLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="h-24 w-24 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-8 w-20 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 h-fit">
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}
