import { Building2, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/Skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/EmptyState"
import type { OpExDto } from "@/lib/api"
import { money } from "./format"

interface OperatingCostsProps {
  items: OpExDto[] | null
  loading?: boolean
  isSellerScope: boolean
  onRecord: () => void
  onVoid: (id: string) => void
}

const CATEGORY_DOT: Record<string, string> = {
  infrastructure: "bg-info",
  tools: "bg-brand-gold",
  other: "bg-muted-foreground",
}

function CategoryDot({ category }: { category: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        CATEGORY_DOT[category] ?? "bg-muted-foreground",
      )}
      aria-hidden
    />
  )
}

function OpexRow({ item, onVoid }: { item: OpExDto; onVoid: (id: string) => void }) {
  const isVoided = item.status !== "active"

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5",
        isVoided && "opacity-50",
      )}
    >
      <CategoryDot category={item.category} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {item.description || item.category}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{item.expenseDate}</span>
          <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
            {item.source}
          </Badge>
          {isVoided && (
            <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
              voided
            </Badge>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          isVoided ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        {money(item.amountCents)}
      </span>
      {item.status === "active" && (
        <button
          type="button"
          onClick={() => onVoid(item.id)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Void cost"
          title="Void"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function OperatingCosts({ items, loading, isSellerScope, onRecord, onVoid }: OperatingCostsProps) {
  if (isSellerScope) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Building2 className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          House-only view
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Operating costs are AfroTransact&apos;s own expenses; they are never attributed to a seller.
        </p>
      </div>
    )
  }

  if (loading || !items) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  const total = items.reduce(
    (acc, i) => acc + (i.status === "active" ? i.amountCents : 0),
    0,
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Operating costs
        </h3>
        <Button size="sm" onClick={onRecord}>
          <Plus className="h-4 w-4" />
          Record a cost
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No operating costs recorded"
          description="Record infrastructure, tooling, or other house expenses for this period."
          action={
            <Button size="sm" onClick={onRecord}>
              <Plus className="h-4 w-4" />
              Record a cost
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <OpexRow key={item.id} item={item} onVoid={onVoid} />
          ))}
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 font-semibold">
            <span className="text-foreground">Total</span>
            <span className="tabular-nums text-foreground">{money(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
