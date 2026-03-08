"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Store, X } from "lucide-react"
import { useCartStore, type CartItem } from "@/stores/cart-store"

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function CartPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const clearCart = useCartStore((s) => s.clearCart)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const getItemsByStore = useCartStore((s) => s.getItemsByStore)

  useEffect(() => {
    setMounted(true)
  }, [])

  const byStoreEntries = mounted ? Array.from(getItemsByStore().entries()) : []
  const subtotal = mounted ? getSubtotal() : 0
  const totalQty = mounted ? getItemCount() : 0
  const estimatedTax = Math.round(subtotal * 0.0825) // 8.25% TX
  const total = subtotal + estimatedTax

  if (!mounted) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8">
        <div className="h-8 w-64 rounded-lg bg-white/5 animate-pulse mb-6" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-5">
            <div className="rounded-2xl border border-white/10 overflow-hidden h-48 animate-pulse" style={{ background: "hsl(0 0% 11%)" }} />
          </div>
          <aside className="lg:w-[340px] shrink-0">
            <div className="rounded-2xl border border-white/10 p-5 h-64 animate-pulse" style={{ background: "hsl(0 0% 11%)" }} />
          </aside>
        </div>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <ShoppingCart className="h-16 w-16 text-gray-500" />
        <h2 className="text-xl font-semibold text-white">Your cart is empty</h2>
        <p className="text-gray-400 text-sm">Add items from the marketplace to get started.</p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-[#0f0f10]"
        >
          Continue Shopping
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          Shopping Cart ({totalQty} {totalQty === 1 ? "item" : "items"})
        </h1>
        <button
          onClick={clearCart}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear Cart
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Cart items column ── */}
        <div className="flex-1 space-y-5">
          {byStoreEntries.map(([storeId, groupItems]) => {
            const storeName = groupItems[0]?.storeName ?? "Unknown Store"
            const storeSubtotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0)
            return (
              <section
                key={storeId}
                className="rounded-2xl border border-white/10 overflow-hidden"
                style={{ background: "hsl(0 0% 11%)" }}
              >
                {/* Store header */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
                  <Store className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-white text-sm">{storeName}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    Subtotal: <span className="text-white font-medium">{formatCents(storeSubtotal)}</span>
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-white/5">
                  {groupItems.map((item) => (
                    <div key={item.variantId} className="flex gap-4 p-4 sm:p-5">
                      {/* Image */}
                      <div
                        className="w-20 h-20 rounded-xl shrink-0 bg-white/5 flex items-center justify-center overflow-hidden"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingCart className="h-8 w-8 text-gray-600" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{item.title}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{item.variantName}</p>
                        <p className="text-primary font-semibold text-sm mt-1">
                          {formatCents(item.price)}
                        </p>

                        <div className="flex items-center gap-3 mt-3">
                          {/* Quantity */}
                          <div className="flex items-center gap-1 rounded-lg border border-white/15 overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center text-gray-300 hover:bg-white/10 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm text-white font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center text-gray-300 hover:bg-white/10 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeItem(item.variantId)}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Line total */}
                      <div className="shrink-0 text-right">
                        <p className="text-white font-semibold text-sm">
                          {formatCents(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* ── Order summary sidebar ── */}
        <aside className="lg:w-[340px] shrink-0">
          <div
            className="rounded-2xl border border-white/10 p-5 sticky top-[110px]"
            style={{ background: "hsl(0 0% 11%)" }}
          >
            <h2 className="text-lg font-bold text-white mb-4">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Subtotal ({totalQty} items)</span>
                <span>{formatCents(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Shipping</span>
                <span className="text-green-400">Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Estimated tax (8.25%)</span>
                <span>{formatCents(estimatedTax)}</span>
              </div>
            </div>

            <div className="my-4 border-t border-white/10" />

            <div className="flex justify-between text-white font-bold text-base">
              <span>Estimated Total</span>
              <span>{formatCents(total)}</span>
            </div>

            <button
              onClick={() => router.push("/checkout")}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
            >
              Proceed to Checkout
              <ArrowRight className="h-4 w-4" />
            </button>

            <Link
              href="/"
              className="mt-3 w-full flex items-center justify-center text-sm text-gray-400 hover:text-white transition-colors py-2"
            >
              Continue Shopping
            </Link>

            <p className="mt-4 text-center text-xs text-gray-500">
              Free shipping on orders over $75
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
