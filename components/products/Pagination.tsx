"use client"

/**
 * Numbered pagination matching the mockup
 *   public/ux-designs/all-products.html lines 374-385
 *   public/ux-designs/deals.html        lines 392-403
 *
 * Active page uses the brand-gold token. Style stays in lockstep with the
 * BrandProductCard so all marketplace listing pages share the same chrome.
 */

import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Window size for the visible page-number buttons. */
  maxVisible?: number
}

export function Pagination({ page, totalPages, onPageChange, maxVisible = 5 }: Props) {
  if (totalPages <= 1) return null

  let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
  const endPage = Math.min(totalPages, startPage + maxVisible - 1)
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1)
  }
  const pages: number[] = []
  for (let i = startPage; i <= endPage; i++) pages.push(i)

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-brand-gold hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>

        {startPage > 1 && (
          <>
            <PageButton onClick={() => onPageChange(1)} active={false}>1</PageButton>
            {startPage > 2 && <Ellipsis />}
          </>
        )}

        {pages.map((p) => (
          <PageButton key={p} onClick={() => onPageChange(p)} active={p === page}>
            {p}
          </PageButton>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <Ellipsis />}
            <PageButton onClick={() => onPageChange(totalPages)} active={false}>
              {totalPages}
            </PageButton>
          </>
        )}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-brand-gold hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
      </p>
    </nav>
  )
}

function Ellipsis() {
  return (
    <span className="grid h-10 w-8 place-items-center text-sm text-muted-foreground" aria-hidden>
      &hellip;
    </span>
  )
}

function PageButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "h-10 min-w-10 rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors",
        active
          ? "bg-brand-gold text-brand-gold-foreground shadow-sm ring-1 ring-brand-gold/40"
          : "border border-border bg-card text-foreground hover:border-brand-gold hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
