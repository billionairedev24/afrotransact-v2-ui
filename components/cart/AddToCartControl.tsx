"use client"

/**
 * Shared "Add to cart" control for storefront rail/card surfaces.
 *
 * Behavior is intentionally NOT the same as a plain button: once the
 * product is in the cart, clicking "Add to cart" again is not possible —
 * the control becomes a −/qty/+ stepper instead. This prevents mis-clicks
 * from silently piling up units (the bug this component was built to fix
 * across ProductRow, ForYouRail, ForYouSection, FeaturedProducts, and
 * BrandProductCard, which each used to re-run their add handler on every
 * click).
 *
 * The control owns cart-state reads itself (items + updateQuantity) — the
 * caller only supplies the productId to match against and its own add
 * handler (onAdd), which fires exactly once, only while qty === 0.
 */

import { Loader2, ShoppingCart } from "lucide-react"
import { useCartStore } from "@/stores/cart-store"
import { cn } from "@/lib/utils"

interface AddToCartControlProps {
  /** Matched against CartItem.productId to find the existing cart line. */
  productId: string
  /** Caller's add handler — invoked only when the product is not yet in the cart. */
  onAdd: (e: React.MouseEvent) => void
  /** Caller's in-flight state for onAdd (e.g. fetching product/variant). */
  adding?: boolean
  /** Out of stock, etc. Callers typically render their own Out-of-Stock button instead of this control when true. */
  disabled?: boolean
  className?: string
  size?: "sm" | "md"
}

export function AddToCartControl({
  productId,
  onAdd,
  adding = false,
  disabled = false,
  className,
  size = "sm",
}: AddToCartControlProps) {
  const cartItem = useCartStore((s) => s.items.find((i) => i.productId === productId))
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const quantity = cartItem?.quantity ?? 0

  const btnPad = size === "md" ? "py-2" : "py-1.5"
  const stepBtn = size === "md" ? "h-8 w-8" : "h-7 w-7"

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function step(e: React.MouseEvent, delta: number) {
    stop(e)
    if (!cartItem) return
    updateQuantity(cartItem.variantId, quantity + delta)
  }

  if (quantity > 0 && cartItem) {
    return (
      <div
        onClick={stop}
        className={cn(
          "flex w-full items-center justify-between rounded-full bg-brand-gold px-1 py-0.5",
          className,
        )}
      >
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={(e) => step(e, -1)}
          className={cn(
            "flex items-center justify-center rounded-full text-brand-gold-foreground font-black text-base hover:bg-black/10 transition-colors",
            stepBtn,
          )}
        >
          −
        </button>
        <span className="text-sm font-black text-brand-gold-foreground tabular-nums">
          {quantity} in cart
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={(e) => step(e, +1)}
          className={cn(
            "flex items-center justify-center rounded-full text-brand-gold-foreground font-black text-base hover:bg-black/10 transition-colors",
            stepBtn,
          )}
        >
          +
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled || adding}
      aria-label="Add to cart"
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-gold text-brand-gold-foreground border border-brand-gold-hover hover:bg-brand-gold-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-xs font-bold",
        btnPad,
        className,
      )}
    >
      {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
      Add to cart
    </button>
  )
}
