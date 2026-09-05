"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Store, X, Sparkles, Tag, Zap, AlertCircle, Lock, Truck, CheckCircle2, ShieldCheck } from "lucide-react"
import { useCartStore, type CartItem } from "@/stores/cart-store"
import { SellOnAfrotransactStrip } from "@/components/landing/SellOnAfrotransactStrip"
import { clearServerCart, prefetchCheckoutShippingContext } from "@/lib/api"
import { RemoteImage } from "@/components/ui/remote-image"
import { getAccessToken } from "@/lib/auth-helpers"
import { useDefaultRegionCommerceGates } from "@/hooks/use-default-region-commerce-gates"
import { useCartEligibility } from "@/components/buyer/useCartEligibility"
import { isHouseStore, storeDisplayName } from "@/lib/house-store"
import { useBuyerLocation } from "@/stores/buyer-location"
import { RegionBlock } from "@/components/geo/RegionBlock"

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function CartPage() {
  const router = useRouter()
  const { status } = useSession()
  const [mounted, setMounted] = useState(false)
  const {
    loading: commerceGatesLoading,
    marketplaceEnabled,
    canEnterCheckoutFlow,
  } = useDefaultRegionCommerceGates()

  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const clearCart = useCartStore((s) => s.clearCart)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const getItemsByStore = useCartStore((s) => s.getItemsByStore)

  const handleClearCart = useCallback(async () => {
    clearCart()
    if (status === "authenticated") {
      try {
        const token = await getAccessToken()
        if (token) await clearServerCart(token)
      } catch {
        // Server clear failed — local state is already cleared
      }
    }
  }, [clearCart, status])

  useEffect(() => {
    setMounted(true)
  }, [])

  const byStoreEntries = mounted ? Array.from(getItemsByStore().entries()) : []
  const storeIds = byStoreEntries.map(([id]) => id)
  const { decisions: eligibilityByStore, hasBlocker: eligibilityBlocked, locationSet } =
    useCartEligibility(storeIds)
  const buyerPostalCode = useBuyerLocation((s) => s.location?.postalCode ?? "")
  // Pass 3 of regions→service_zones: free-shipping threshold now sourced from
  // the resolved Service Zone. No legacy fallback — banner is hidden when no
  // zone resolves or the zone does not declare a threshold.
  const resolvedZoneThreshold = useBuyerLocation(
    (s) => s.resolvedZone?.effectiveSettings?.freeShippingThresholdCents ?? null,
  )
  const resolvedZoneTaxRate = useBuyerLocation(
    (s) => s.resolvedZone?.effectiveSettings?.taxRate ?? null,
  )
  const freeShippingThresholdCents: number | null = mounted ? resolvedZoneThreshold : null
  const subtotal = mounted ? getSubtotal() : 0
  const totalQty = mounted ? getItemCount() : 0
  // Estimate from the resolved zone's configured rate — never a hardcoded
  // fallback. An unconfigured / zero-rate zone shows $0.00, matching what
  // checkout actually charges.
  const estimatedTax = mounted ? Math.round(subtotal * (resolvedZoneTaxRate ?? 0)) : 0
  const total = subtotal + estimatedTax

  // Non-operational zones: block cart entirely. RegionBlock handles its own
  // status check; we just need to wrap children so they never render in a
  // coming_soon / disabled / not_serviced region.
  const resolvedStatus = useBuyerLocation((s) => s.resolvedZone?.status)
  if (mounted && (resolvedStatus === "coming_soon" || resolvedStatus === "disabled" || resolvedStatus === "not_serviced")) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8">
        <RegionBlock>{null}</RegionBlock>
      </main>
    )
  }

  if (!mounted) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8">
        <div className="h-8 w-64 rounded-lg bg-gray-50 animate-pulse mb-6" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden h-48 animate-pulse" />
          </div>
          <aside className="lg:w-[340px] shrink-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 h-64 animate-pulse" />
          </aside>
        </div>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/10">
            <ShoppingCart className="h-14 w-14 text-foreground/40" strokeWidth={1.5} />
          </div>
          {/* floating icons */}
          <span className="absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 border-2 border-white shadow-sm">
            <Tag className="h-4 w-4 text-orange-500" />
          </span>
          <span className="absolute -bottom-1 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 border-2 border-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          </span>
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 text-sm text-center max-w-xs leading-relaxed mb-1">
          Looks like you haven&apos;t added anything yet.
        </p>
        <p className="text-gray-400 text-xs text-center mb-8">
          Browse the marketplace and find something you love!
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-gold px-8 py-3.5 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold/90 transition-colors shadow-lg shadow-primary/20"
          >
            <ShoppingCart className="h-4 w-4" />
            Start Shopping
          </Link>
          <Link
            href="/deals"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-8 py-3.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Zap className="h-4 w-4 text-orange-500" />
            Today&apos;s Deals
          </Link>
        </div>

        {/* Subtle suggestion row */}
        <div className="mt-12 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          {[
            { href: "/search?sort=rating", label: "Top rated" },
            { href: "/search?sort=newest", label: "New arrivals" },
            { href: "/categories", label: "Browse categories" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-full border border-border px-4 py-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Sell CTA — empty-cart visitors have low purchase intent right
            now but high alternative-action intent. Auto-hidden for admin
            + sellers. */}
        <div className="w-full max-w-2xl mt-12">
          <SellOnAfrotransactStrip />
        </div>
      </main>
    )
  }

  // Free-shipping progress (only when a positive threshold is configured for
  // the resolved zone). -1 = always-free; null = unknown → no bar.
  const hasFreeShipThreshold =
    freeShippingThresholdCents !== null && freeShippingThresholdCents > 0
  const freeShipUnlocked =
    freeShippingThresholdCents === -1 ||
    (hasFreeShipThreshold && subtotal >= (freeShippingThresholdCents as number))
  const freeShipRemaining = hasFreeShipThreshold
    ? Math.max(0, (freeShippingThresholdCents as number) - subtotal)
    : 0
  const freeShipPct = hasFreeShipThreshold
    ? Math.min(100, Math.round((subtotal / (freeShippingThresholdCents as number)) * 100))
    : 0
  const checkoutDisabled =
    !mounted || commerceGatesLoading || !canEnterCheckoutFlow || eligibilityBlocked
  const warmCheckout = () => {
    if (status === "authenticated") {
      getAccessToken().then((t) => { if (t) prefetchCheckoutShippingContext(t) })
    }
  }

  return (
    <main className="mx-auto max-w-[1240px] px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shopping Cart</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {totalQty} {totalQty === 1 ? "item" : "items"}
          </p>
        </div>
        <button
          onClick={handleClearCart}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-500/10 hover:text-red-700 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear cart
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Cart items column ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Free-shipping progress — the strongest nudge Amazon leans on. */}
          {hasFreeShipThreshold && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              {freeShipUnlocked ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Your order qualifies for FREE shipping.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  <Truck className="h-5 w-5 shrink-0 text-brand-gold" />
                  Add <span className="font-bold text-gray-900">{formatCents(freeShipRemaining)}</span> to get FREE shipping
                </p>
              )}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${freeShipUnlocked ? "bg-green-500" : "bg-brand-gold"}`}
                  style={{ width: `${freeShipUnlocked ? 100 : freeShipPct}%` }}
                />
              </div>
            </div>
          )}

          {byStoreEntries.map(([storeId, groupItems]) => {
            const eligibility = eligibilityByStore.get(storeId)
            const blocked = eligibility?.result === "not_eligible"
            const sellerName = storeDisplayName(storeId, groupItems[0]?.storeName)
            return (
              <section
                key={storeId}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
              >
                {/* Seller group header — Amazon groups the cart by who fulfills it. */}
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/15">
                    <Store className="h-3.5 w-3.5 text-gray-700" />
                  </span>
                  <p className="text-sm font-semibold text-gray-900">{sellerName}</p>
                  {isHouseStore(storeId) && (
                    <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
                      Official
                    </span>
                  )}
                </div>

                {blocked && (
                  <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-800 sm:px-5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      {isHouseStore(storeId) ? "AfroTransact doesn't deliver to " : "This seller doesn't ship to "}
                      <span className="font-semibold">{buyerPostalCode || "your area"}</span>{" "}
                      yet. Remove these items or change your delivery location to continue.
                    </span>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {groupItems.map((item) => (
                    <div key={item.variantId} className="flex gap-4 p-4 sm:p-5">
                      <Link
                        href={`/product/${item.slug}`}
                        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            sizes="96px"
                            className="object-cover transition-transform duration-200 hover:scale-105"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <ShoppingCart className="h-8 w-8 text-gray-400" />
                          </span>
                        )}
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/product/${item.slug}`}
                              className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 hover:text-brand-gold-hover"
                            >
                              {item.title}
                            </Link>
                            {item.variantName && (
                              <p className="mt-0.5 text-xs text-gray-500">{item.variantName}</p>
                            )}
                            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> In stock
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-bold tabular-nums text-gray-900">
                              {formatCents(item.price * item.quantity)}
                            </p>
                            {item.quantity > 1 && (
                              <p className="mt-0.5 text-[11px] text-gray-400 tabular-nums">
                                {formatCents(item.price)} each
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
                          <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 touch-manipulation">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                              className="flex h-9 min-h-9 w-9 min-w-9 items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
                              aria-label="Decrease quantity"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[2.5rem] px-1 text-center text-sm font-semibold tabular-nums text-gray-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                              className="flex h-9 min-h-9 w-9 min-w-9 items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <span className="h-4 w-px bg-gray-200" aria-hidden />

                          <button
                            type="button"
                            onClick={() => removeItem(item.variantId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Continue shopping
          </Link>
        </div>

        {/* ── Order summary sidebar ── */}
        <aside className="lg:w-[360px] shrink-0">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sticky top-[110px]">
            {/* Lead with the subtotal + CTA (Amazon puts the decision first). */}
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">Subtotal ({totalQty} {totalQty === 1 ? "item" : "items"})</span>
              <span className="text-xl font-bold tabular-nums text-gray-900">{formatCents(subtotal)}</span>
            </div>

            {freeShipUnlocked && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Eligible for FREE shipping
              </p>
            )}

            {mounted && eligibilityBlocked && (
              <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <span>One or more items don&apos;t ship to your delivery location. Remove them or change the location to check out.</span>
              </div>
            )}
            {mounted && !eligibilityBlocked && !locationSet && storeIds.length > 0 && (
              <div className="mt-4 flex gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                <span>Set a delivery location (top of page) to confirm these items ship to you.</span>
              </div>
            )}
            {mounted && !commerceGatesLoading && !marketplaceEnabled && (
              <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <span>Checkout is temporarily paused (marketplace toggle). You can still edit your cart.</span>
              </div>
            )}

            <button
              onClick={() => router.push("/checkout")}
              onMouseEnter={warmCheckout}
              onPointerDown={warmCheckout}
              disabled={checkoutDisabled}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-colors ${
                checkoutDisabled
                  ? "cursor-not-allowed bg-gray-200 text-gray-500"
                  : "bg-brand-gold text-[#0f0f10] hover:bg-brand-gold/90"
              }`}
            >
              Proceed to Checkout
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
              <Lock className="h-3 w-3" /> Secure checkout · Powered by Stripe
            </p>

            <div className="my-4 border-t border-gray-100" />

            {/* Detailed breakdown — secondary to the decision above. */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Items ({totalQty})</span>
                <span className="tabular-nums">{formatCents(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                {freeShipUnlocked ? (
                  <span className="font-semibold text-green-600">Free</span>
                ) : (
                  <span className="text-gray-400">Calculated at checkout</span>
                )}
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                {resolvedZoneTaxRate == null ? (
                  <span className="text-gray-400">Calculated at checkout</span>
                ) : resolvedZoneTaxRate === 0 ? (
                  <span className="font-medium text-green-600">No tax</span>
                ) : (
                  <span className="tabular-nums">{formatCents(estimatedTax)}</span>
                )}
              </div>
            </div>

            <div className="my-4 border-t border-gray-200" />

            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold text-gray-900">Estimated total</span>
              <span className="text-lg font-bold tabular-nums text-gray-900">{formatCents(total)}</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Final total, shipping &amp; tax are confirmed at checkout.
            </p>

            {/* Trust strip */}
            <div className="mt-4 flex items-center justify-center gap-4 border-t border-gray-100 pt-4 text-[11px] font-medium text-gray-500">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Buyer protection</span>
              <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-gray-400" /> Tracked delivery</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
