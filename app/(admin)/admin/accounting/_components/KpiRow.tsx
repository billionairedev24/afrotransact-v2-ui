import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface KpiItem {
  label: string
  value: string
  hero?: boolean
  delta?: { pct: number; up: boolean }
}

function KpiCard({ item }: { item: KpiItem }) {
  const { label, value, hero, delta } = item

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        hero && "border-transparent bg-brand-dark text-brand-dark-foreground",
      )}
    >
      <p
        className={cn(
          "text-sm",
          hero ? "text-brand-dark-foreground/70" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-display mt-1 text-2xl tabular-nums sm:text-3xl",
          hero ? "text-brand-gold" : "text-foreground",
        )}
      >
        {value}
      </p>
      {delta && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-sm font-medium tabular-nums",
            delta.up ? "text-brand-green" : "text-destructive",
          )}
        >
          {delta.up ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )}
          <span>
            {delta.up ? "+" : "-"}
            {Math.abs(delta.pct).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <KpiCard key={`${item.label}-${i}`} item={item} />
      ))}
    </div>
  )
}
