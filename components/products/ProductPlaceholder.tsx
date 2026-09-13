import { cn } from "@/lib/utils"

/**
 * Branded stand-in for a product with no photograph yet.
 *
 * The alternative we tried was worse than nothing: placeholder image services
 * return whatever matches a keyword, which put a photograph of the Milky Way on
 * a bag of pepper and a wolf on the Electronics tile. A wrong photo actively
 * misinforms — a buyer scanning a grid reads it as the product. A deliberate
 * blank does not.
 *
 * The tint is derived from the title so a grid of placeholders reads as a set
 * of distinct products rather than a column of identical grey squares, and so
 * the same product keeps the same colour between renders and pages.
 */

const TINTS = [
  "from-emerald-800 to-emerald-950",
  "from-amber-700 to-amber-900",
  "from-rose-800 to-rose-950",
  "from-slate-700 to-slate-900",
  "from-violet-800 to-violet-950",
  "from-teal-800 to-teal-950",
  "from-orange-700 to-orange-900",
  "from-indigo-800 to-indigo-950",
]

/** Stable, order-independent hash so a title always maps to one tint. */
function tintFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

export function ProductPlaceholder({
  title,
  className,
  showTitle = true,
}: {
  title: string
  className?: string
  /** Off for small tiles where the text would be unreadable anyway. */
  showTitle?: boolean
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br p-3 text-center",
        tintFor(title),
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-mark.svg"
        alt=""
        aria-hidden
        className="h-8 w-8 opacity-70 invert"
      />
      {showTitle && (
        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-white/85">
          {title}
        </span>
      )}
      <span className="sr-only">No photo available for {title}</span>
    </div>
  )
}
