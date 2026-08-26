import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/Skeleton"
import type { PnlDto, PnlLine } from "@/lib/api"
import { money } from "./format"

interface PnlStatementProps {
  pnl: PnlDto | null
  loading?: boolean
}

function barColor(line: PnlLine): string {
  if (line.role === "BASE") return "bg-brand-gold"
  return line.amountCents < 0 ? "bg-destructive" : "bg-brand-green"
}

function PnlRow({ line, max }: { line: PnlLine; max: number }) {
  const isNegative = line.amountCents < 0
  const pct = max > 0 ? Math.min(100, (Math.abs(line.amountCents) / max) * 100) : 0

  if (line.role === "SUBTOTAL") {
    return (
      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 font-semibold">
        <span className="text-foreground">{line.label}</span>
        <span
          className={cn(
            "tabular-nums",
            isNegative ? "text-destructive" : "text-foreground",
          )}
        >
          {money(line.amountCents)}
        </span>
      </div>
    )
  }

  if (line.role === "TOTAL") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-3.5">
        <span className="font-semibold text-foreground">{line.label}</span>
        <span
          className={cn(
            "font-display tabular-nums text-xl sm:text-2xl",
            isNegative ? "text-destructive" : "text-brand-gold-ink",
          )}
        >
          {money(line.amountCents)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="w-32 shrink-0 truncate text-sm text-muted-foreground sm:w-48">
        {line.label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", barColor(line))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "w-28 shrink-0 text-right text-sm tabular-nums",
          isNegative ? "text-destructive" : "text-foreground",
        )}
      >
        {money(line.amountCents)}
      </span>
    </div>
  )
}

export function PnlStatement({ pnl, loading }: PnlStatementProps) {
  if (loading || !pnl) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  const barLines = pnl.lines.filter(
    (l) => l.role !== "SUBTOTAL" && l.role !== "TOTAL",
  )
  const max = barLines.reduce(
    (acc, l) => Math.max(acc, Math.abs(l.amountCents)),
    0,
  )

  return (
    <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4">
      {pnl.lines.map((line, i) => (
        <PnlRow key={`${line.label}-${i}`} line={line} max={max} />
      ))}
    </div>
  )
}
