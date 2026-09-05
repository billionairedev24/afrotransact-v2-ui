"use client"

import { cn } from "@/lib/utils"

/**
 * A compact, brand-coloured mini card — the small thumbnail shown next to a
 * saved card (e.g. in the checkout card picker), like the brand glyph Stripe
 * renders inside its card-number input. Uses the same per-brand gradients as
 * the full account PaymentCard so the two read as one system.
 */
const BRAND_GRADIENT: Record<string, string> = {
  amex: "linear-gradient(120deg, #3a1c1c 0%, #8a5a2b 55%, #d4a24a 100%)",
  visa: "linear-gradient(120deg, #0f2a6b 0%, #1a3f8f 55%, #2b6fd4 100%)",
  mastercard: "linear-gradient(120deg, #7a1f1f 0%, #b8431f 55%, #e8863a 100%)",
  discover: "linear-gradient(120deg, #7a3a12 0%, #c9631f 55%, #f0912e 100%)",
}
const DEFAULT_GRADIENT = "linear-gradient(120deg, #23201a 0%, #4a4636 55%, #a98b2f 100%)"

function gradientFor(brand: string | null): string {
  return (brand && BRAND_GRADIENT[brand.toLowerCase()]) || DEFAULT_GRADIENT
}

// Short wordmark that fits the mini card.
function shortMark(brand: string | null): string {
  const b = (brand ?? "").toLowerCase()
  if (b === "mastercard") return "MC"
  if (b === "amex" || b === "american express") return "AMEX"
  if (b === "visa") return "VISA"
  if (b === "discover") return "DISC"
  return brand ? brand.slice(0, 4).toUpperCase() : "CARD"
}

export function CardBrandMark({ brand, className }: { brand: string | null; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md text-white shadow-sm ring-1 ring-black/10",
        className,
      )}
      style={{ backgroundImage: gradientFor(brand) }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.3), transparent 60%)" }}
      />
      <span className="relative text-[10px] font-extrabold italic tracking-tight drop-shadow-sm">
        {shortMark(brand)}
      </span>
    </div>
  )
}
