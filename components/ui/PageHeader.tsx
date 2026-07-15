import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * One heading treatment for every portal page — the Fraunces display face +
 * a real scale, an optional subtitle, and an actions slot. Replaces the
 * ~40 hand-typed `text-2xl font-bold` page titles across admin + seller.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-[1.7rem] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
