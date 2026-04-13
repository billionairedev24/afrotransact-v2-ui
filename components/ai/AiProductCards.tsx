"use client"

import Link from "next/link"
import { Package, ShoppingCart } from "lucide-react"
import { type ProductCard } from "@/stores/ai-store"
import { useCartStore } from "@/stores/cart-store"
import { getProductById } from "@/lib/api"
import { toast } from "sonner"
import { useState } from "react"

function AiProductCard({ product }: { product: ProductCard }) {
  const [adding, setAdding] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const inCart = useCartStore((s) => s.items.some((i) => i.productId === product.product_id))
  const path = (product.slug?.trim()) || product.product_id

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (adding || inCart || !product.in_stock) return
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
      toast.success(`${p.title} added to cart`)
    } catch {
      toast.error("Could not add to cart")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 w-[120px] shrink-0">
      <Link href={`/product/${encodeURIComponent(path)}`} className="block">
        <div className="aspect-square bg-muted/40 flex items-center justify-center p-1.5">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title}
              className="h-full w-full object-contain group-hover:scale-[1.03] transition-transform duration-200"
            />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>
        <div className="px-2 pt-1.5 pb-1">
          <p className="text-[10px] font-medium text-card-foreground line-clamp-2 leading-tight">
            {product.title}
          </p>
          <p className="text-[11px] font-bold text-primary mt-0.5">
            ${product.min_price.toFixed(2)}
          </p>
          {!product.in_stock && (
            <p className="text-[9px] text-red-500 font-medium mt-0.5">Out of stock</p>
          )}
        </div>
      </Link>
      <button
        onClick={handleAdd}
        disabled={adding || inCart || !product.in_stock}
        className={`mx-2 mb-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold transition-colors ${
          inCart
            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
            : product.in_stock
            ? "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        <ShoppingCart className="h-3 w-3" />
        {inCart ? "In Cart" : adding ? "Adding…" : "Add"}
      </button>
    </div>
  )
}

export function AiProductCards({ products }: { products: ProductCard[] }) {
  if (!products.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mt-2 snap-x snap-mandatory">
      {products.map((p) => (
        <div key={p.product_id} className="snap-start">
          <AiProductCard product={p} />
        </div>
      ))}
    </div>
  )
}
