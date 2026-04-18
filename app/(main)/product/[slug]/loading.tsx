export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="aspect-square rounded-xl bg-muted animate-pulse" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-md bg-muted animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="h-10 w-40 rounded bg-muted animate-pulse" />
          <div className="space-y-2 pt-4">
            <div className="h-4 rounded bg-muted animate-pulse" />
            <div className="h-4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex gap-3 pt-4">
            <div className="h-12 flex-1 rounded-lg bg-muted animate-pulse" />
            <div className="h-12 w-32 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
