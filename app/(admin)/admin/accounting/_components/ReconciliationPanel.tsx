import { CheckCircle2, AlertTriangle, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/Skeleton"
import { Badge } from "@/components/ui/badge"
import type { ReconciliationDto } from "@/lib/api"
import { money } from "./format"

interface ReconciliationPanelProps {
  data: ReconciliationDto | { applicable: false; reason: string } | null
  loading?: boolean
  isSellerScope: boolean
}

function isNotApplicable(
  data: ReconciliationDto | { applicable: false; reason: string } | null,
): data is { applicable: false; reason: string } {
  return !!data && "applicable" in data && data.applicable === false
}

function HouseOnlyNotice({ description }: { description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Building2 className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">
        House-only view
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function MatchChip({ deltaCents }: { deltaCents: number }) {
  if (deltaCents === 0) {
    return (
      <Badge variant="success" className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Reconciled
      </Badge>
    )
  }
  return (
    <Badge variant="warning" className="inline-flex items-center gap-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      {`△ ${money(deltaCents)}`}
    </Badge>
  )
}

export function ReconciliationPanel({ data, loading, isSellerScope }: ReconciliationPanelProps) {
  if (isSellerScope) {
    return (
      <HouseOnlyNotice description="Reconciliation reflects AfroTransact's platform balance against Stripe. A seller's money moves through Stripe Connect directly to their bank — see their P&L for their own numbers." />
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (isNotApplicable(data)) {
    return <HouseOnlyNotice description={data.reason} />
  }

  const stripeTotal = data.stripeAvailableCents + data.stripePendingCents

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Ledger balance</p>
          <p className="font-display text-xl tabular-nums text-foreground">
            {money(data.ledgerBalanceCents)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-muted-foreground">
            Stripe (available + pending)
          </p>
          <p className="font-display text-xl tabular-nums text-foreground">
            {money(stripeTotal)}
          </p>
        </div>
        <MatchChip deltaCents={data.deltaCents} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Fees booked</p>
          <p className="font-display text-xl tabular-nums text-foreground">
            {money(data.ledgerFeeCents)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-muted-foreground">Stripe fees</p>
          <p className="font-display text-xl tabular-nums text-foreground">
            {money(data.stripeFeeCents)}
          </p>
        </div>
        <MatchChip deltaCents={data.feeDeltaCents} />
      </div>

      {data.notes && (
        <p className={cn("px-1 text-xs text-muted-foreground")}>{data.notes}</p>
      )}
    </div>
  )
}
