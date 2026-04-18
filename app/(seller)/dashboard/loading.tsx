export default function SellerDashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-56 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-7 w-24 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-52 rounded bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-52 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}
