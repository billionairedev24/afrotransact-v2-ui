"use client"

import { cn } from "@/lib/utils"

export type PeriodKey = "mtd" | "lastMonth" | "custom"

export interface PeriodChange {
  key: PeriodKey
  from?: string
  to?: string
}

export interface PeriodSelectProps {
  value: PeriodKey
  onChange: (period: PeriodChange) => void
}

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "mtd", label: "MTD" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
]

/** Month-to-date range: first of this month → now, as ISO date-times. */
function mtdRange(now: Date): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: from.toISOString(), to: now.toISOString() }
}

/** Full previous calendar month, as ISO date-times. */
function lastMonthRange(now: Date): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function PeriodSelect({ value, onChange }: PeriodSelectProps) {
  function select(key: PeriodKey) {
    if (key === "custom") {
      // Minimal for now — parent renders date inputs and re-emits with from/to.
      onChange({ key: "custom" })
      return
    }
    const now = new Date()
    const range = key === "mtd" ? mtdRange(now) : lastMonthRange(now)
    onChange({ key, ...range })
  }

  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(opt.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border border-brand-gold bg-brand-gold text-brand-gold-foreground"
                : "border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
