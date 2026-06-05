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
    <div className="mt-10 flex items-center justify-center gap-2">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
        className="h-10 w-10 rounded-lg flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </button>

      {startPage > 1 && (
        <>
          <PageButton onClick={() => onPageChange(1)} active={false}>1</PageButton>
          {startPage > 2 && <span className="px-1 text-sm text-gray-400">&hellip;</span>}
        </>
      )}

      {pages.map((p) => (
        <PageButton key={p} onClick={() => onPageChange(p)} active={p === page}>
          {p}
        </PageButton>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-1 text-sm text-gray-400">&hellip;</span>}
          <PageButton onClick={() => onPageChange(totalPages)} active={false}>
            {totalPages}
          </PageButton>
        </>
      )}

      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
        className="h-10 w-10 rounded-lg flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
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
      className={cn(
        "h-10 w-10 rounded-lg text-sm font-semibold transition-colors",
        active
          ? "bg-brand-gold text-brand-gold-foreground shadow-sm"
          : "border border-gray-200 bg-white text-foreground hover:border-brand-gold hover:bg-gray-50",
      )}
    >
      {children}
    </button>
  )
}
