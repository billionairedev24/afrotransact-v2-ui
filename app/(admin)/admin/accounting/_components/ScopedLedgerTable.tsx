import { Fragment } from "react"
import { Skeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/ui/EmptyState"
import { ScrollText, Scale } from "lucide-react"
import type { JournalEntryRow, TrialBalanceRow } from "@/lib/api"
import { money } from "./format"

const TYPE_ORDER = ["asset", "liability", "revenue", "expense", "receivable"]
const TYPE_LABEL: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  revenue: "Revenue",
  expense: "Expenses",
  receivable: "Receivables",
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
}

interface JournalTableProps {
  entries: JournalEntryRow[] | null
  loading?: boolean
}

/** Scoped general-journal table — one row per journal entry, lines flattened underneath. */
export function JournalTable({ entries, loading }: JournalTableProps) {
  if (loading || !entries) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No journal entries"
        description="No postings for this account and period."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Posted</th>
            <th className="px-4 py-2 font-medium">Event</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium">Account</th>
            <th className="w-28 px-4 py-2 text-right font-medium">Debit</th>
            <th className="w-28 px-4 py-2 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((en) => (
            <Fragment key={en.id}>
              {en.lines.map((l, i) => (
                <tr key={`${en.id}-${i}`} className="border-b border-border/60">
                  {i === 0 ? (
                    <>
                      <td rowSpan={en.lines.length} className="px-4 py-2 align-top text-xs text-muted-foreground">
                        {fmtDateTime(en.postedAt)}
                      </td>
                      <td rowSpan={en.lines.length} className="px-4 py-2 align-top text-xs">
                        {en.eventType}
                      </td>
                      <td rowSpan={en.lines.length} className="px-4 py-2 align-top text-foreground">
                        {en.description || "—"}
                      </td>
                    </>
                  ) : null}
                  <td className="px-4 py-2">
                    <code className="text-xs">{l.accountCode ?? "—"}</code>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.direction === "DR" ? money(l.amountCents) : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.direction === "CR" ? money(l.amountCents) : ""}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface TrialBalanceTableProps {
  rows: TrialBalanceRow[] | null
  totalDebitsCents?: number
  totalCreditsCents?: number
  loading?: boolean
}

/** Scoped trial-balance table, grouped by account type with a grand total row. */
export function TrialBalanceTable({ rows, totalDebitsCents, totalCreditsCents, loading }: TrialBalanceTableProps) {
  if (loading || !rows) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No trial-balance rows"
        description="No account activity for this account and period."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Account</th>
            <th className="w-36 px-4 py-2 text-right font-medium">Debit</th>
            <th className="w-36 px-4 py-2 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {TYPE_ORDER.filter((t) => rows.some((r) => r.type === t)).map((type) => (
            <Fragment key={type}>
              <tr className="bg-muted/40">
                <td colSpan={3} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {TYPE_LABEL[type] ?? type}
                </td>
              </tr>
              {rows
                .filter((r) => r.type === type)
                .map((r) => (
                  <tr key={`${r.code}-${r.partyId ?? ""}`} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <div className="text-foreground">{r.name}</div>
                      <code className="text-[10px] text-muted-foreground">{r.code}</code>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.debitCents ? money(r.debitCents) : ""}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.creditCents ? money(r.creditCents) : ""}
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
          {(totalDebitsCents !== undefined || totalCreditsCents !== undefined) && (
            <tr className="border-t-2 border-foreground font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totalDebitsCents ?? 0)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totalCreditsCents ?? 0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
