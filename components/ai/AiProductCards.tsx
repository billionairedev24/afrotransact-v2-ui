"use client"

import Link from "next/link"
import { Package, ShoppingCart, Loader2 } from "lucide-react"
import { type ProductCard } from "@/stores/ai-store"
import { useCartStore } from "@/stores/cart-store"
import { getProductById } from "@/lib/api"
import { toast } from "sonner"
import { useState } from "react"

function AiProductCard({ product }: { product: ProductCard }) {
  const [adding, setAdding] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const cartItem = useCartStore((s) => s.items.find((i) => i.productId === product.product_id))
  const quantity = cartItem?.quantity ?? 0
  const path = product.slug?.trim() || product.product_id

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (adding || !product.in_stock) return
    setAdding(true)
    try {
      const p = await getProductById(product.product_id)
      const variant = p.variants?.[0]
      if (!variant) { toast.error("No purchasable variant"); return }
      addItem({
        productId: p.id,
        variantId: variant.id,
        storeId: p.storeId,
        storeName: product.store_name || p.storeId,
        title: p.title,
        variantName: variant.name || "Default",
        price: Math.round(variant.price * 100),
        quantity: 1,
        imageUrl: product.image_url || p.images?.[0]?.url,
        slug: p.slug,
        weightKg: variant.weightKg ?? null,
        lengthIn: variant.lengthIn ?? null,
        widthIn: variant.widthIn ?? null,
        heightIn: variant.heightIn ?? null,
      })
    } catch {
      toast.error("Could not add to cart")
    } finally {
      setAdding(false)
    }
  }

  function handleChange(e: React.MouseEvent, delta: number) {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem) return
    updateQuantity(cartItem.variantId, quantity + delta)
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 w-[160px] shrink-0">
      <Link href={`/product/${encodeURIComponent(path)}`} className="block">
        <div className="h-[140px] bg-muted/40 flex items-center justify-center p-2 overflow-hidden">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title}
              className="h-full w-full object-contain group-hover:scale-[1.04] transition-transform duration-200"
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground/40" />
          )}
          {!product.in_stock && (
            <span className="absolute top-2 left-2 text-[9px] font-bold rounded-md px-1.5 py-0.5 bg-red-500/90 text-white">
              Out of stock
            </span>
          )}
        </div>
        <div className="px-2.5 pt-2 pb-1.5 space-y-0.5">
          <p className="text-[11px] font-semibold text-card-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {product.title}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-bold text-primary">${product.min_price.toFixed(2)}</span>
            {product.max_price > product.min_price && (
              <span className="text-[10px] text-muted-foreground">–${product.max_price.toFixed(2)}</span>
            )}
          </div>
          {product.store_name && (
            <p className="text-[10px] text-muted-foreground truncate">{product.store_name}</p>
          )}
        </div>
      </Link>

      <div className="px-2.5 pb-2.5 mt-auto">
        {!product.in_stock ? (
          <button disabled className="w-full flex items-center justify-center rounded-lg bg-gray-100 py-1.5 text-[10px] font-medium text-gray-400 cursor-not-allowed">
            Out of stock
          </button>
        ) : quantity > 0 ? (
          <div
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="flex w-full items-center justify-between rounded-lg bg-primary px-1 py-0.5"
          >
            <button
              onClick={(e) => handleChange(e, -1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
            >
              −
            </button>
            <span className="text-sm font-black text-[#0f0f10] tabular-nums">{quantity}</span>
            <button
              onClick={(e) => handleChange(e, +1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="w-full flex items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
            {adding ? "Adding…" : "Add to Cart"}
          </button>
        )}
      </div>
    </div>
  )
}

export function AiProductCards({ products, label }: { products: ProductCard[]; label?: string }) {
  if (!products.length) return null
  return (
    <div className="mt-2.5 space-y-1.5">
      {label && (
        <p className="text-[11px] font-medium text-muted-foreground px-0.5">
          {label}
        </p>
      )}
      <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {products.map((p) => (
          <div key={p.product_id} className="snap-start">
            <AiProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  )
}
