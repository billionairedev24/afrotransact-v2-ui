import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-border bg-card overflow-hidden">
      <Skeleton className="h-[120px] sm:aspect-square w-full rounded-none" />
      <div className="p-2 sm:p-3 space-y-2">
        <Skeleton className="h-3 sm:h-4 w-3/4" />
        <Skeleton className="h-2.5 sm:h-3 w-1/2" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
    </div>
  )
}

export function StoreCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <Skeleton className="h-28 w-full rounded-none" />
      <div className="pt-8 px-4 pb-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted flex justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="px-4 sm:px-5 py-2.5 border-b border-border">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      {[1, 2].map((k) => (
        <div key={k} className="flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-border/50">
          <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3.5 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}
