"use client"

import { Loader2, Star, Trash2 } from "lucide-react"

/**
 * A saved payment method rendered as a physical-looking credit card, adapted to
 * the data Stripe gives us: brand, last4, expiry, and the account holder's name.
 * We never receive the full PAN — only last4 — so the number is masked with
 * bullets and the real digits fill the final group.
 */

// Brand → gradient. Warm, premium, and brand-appropriate; light text sits on
// all of them with adequate contrast.
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

function brandWordmark(brand: string | null): string {
  return brand ? brand.toUpperCase() : "CARD"
}

function cardExpiry(month: number | null, year: number | null): string {
  if (!month || !year) return "—"
  return `${month}/${year}`
}

export interface PaymentCardProps {
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  holderName?: string | null
  isDefault: boolean
  settingDefault: boolean
  deleting: boolean
  onSetDefault: () => void
  onDelete: () => void
}

export function PaymentCard({
  brand,
  last4,
  expMonth,
  expYear,
  holderName,
  isDefault,
  settingDefault,
  deleting,
  onSetDefault,
  onDelete,
}: PaymentCardProps) {
  return (
    <div
      className="relative flex aspect-[1.586/1] w-full max-w-sm flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-lg ring-1 ring-black/10"
      style={{ backgroundImage: gradientFor(brand) }}
    >
      {/* Sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.28), transparent 60%)" }}
      />

      {/* Actions + default badge */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-4">
          {isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              <Star className="h-3 w-3 fill-current" />
              Default
            </span>
          ) : (
            <button
              onClick={onSetDefault}
              disabled={settingDefault}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white disabled:opacity-60"
              title="Use this card for 1-click reorder"
            >
              {settingDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              Set default
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>

      {/* Number + brand */}
      <div className="relative">
        <div className="font-mono text-xl tracking-[0.15em] tabular-nums drop-shadow-sm sm:text-2xl">
          <span className="align-middle text-lg tracking-[0.2em] sm:text-xl">•••• •••• ••••</span>{" "}
          {last4 ?? "••••"}
        </div>
        <div className="mt-2 text-2xl font-extrabold italic tracking-tight drop-shadow-sm">
          {brandWordmark(brand)}
        </div>
      </div>

      {/* Holder + expiry */}
      <div className="relative flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-white/70">Card holder</div>
          <div className="truncate text-sm font-semibold">{holderName?.trim() || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/70">Expiry date</div>
          <div className="text-sm font-semibold tabular-nums">{cardExpiry(expMonth, expYear)}</div>
        </div>
      </div>
    </div>
  )
}
