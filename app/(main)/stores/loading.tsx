export default function StoresLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
          >
            <div className="h-14 w-14 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
