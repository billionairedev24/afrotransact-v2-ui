import { getStatusStyle } from "@/lib/status-config"
import { cn } from "@/lib/utils"

/**
 * The one status pill — resolves any order/subscription/billing status string
 * through `lib/status-config` so the same state reads the same everywhere,
 * instead of the per-page rainbow maps.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = getStatusStyle(status)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        s.text,
        s.bgBorder,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
