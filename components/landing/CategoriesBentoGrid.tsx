import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { CategoryRef, SearchResult } from "@/lib/api"

/**
 * Categories grid — faithful port of public/ux-designs/code.html lines 205-264.
 *
 * Layout: 4 EQUAL columns on md+ (md:grid-cols-4). Each card has its own
 * internal composition based on slug — this matches the mockup which uses
 * different visual treatments per category (NOT a bento with one card bigger).
 *
 *   • food-grocery → 2×2 product thumbnail grid (4 thumbs)
 *   • electronics  → 1 tall aspect-[4/5] thumbnail
 *   • fashion      → 2 square thumbnails + description copy
 *   • home-garden  → 1 square thumbnail
 *   • (any other)  → fallback to 1 square thumbnail
 *
 * Empty cells render as a soft brand-tint gradient. NEVER broken images or
 * placeholder icons. `CategoryRef` has no imageUrl field, so imagery comes
 * entirely from productsByCategoryId (server-computed in app/page.tsx).
 */

const TINT = "bg-gradient-to-br from-amber-50 to-orange-100"

interface CategoriesBentoGridProps {
  categories: CategoryRef[]
  productsByCategoryId: Record<string, SearchResult[]>
}

function Thumb({
  product,
  className,
}: {
  product: SearchResult
  className: string
}) {
  const href = `/product/${product.slug || product.product_id}`
  return (
    <Link
      href={href}
      title={product.title}
      className={`block relative overflow-hidden rounded ${TINT} ${className} hover:ring-2 hover:ring-brand-gold transition-shadow`}
    >
      <Image
        src={product.image_url!}
        alt={product.title}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover transition-transform hover:scale-[1.04]"
      />
    </Link>
  )
}

function CategoryCard({
  category,
  products,
}: {
  category: CategoryRef
  products: SearchResult[]
}) {
  const slug = category.slug
  const href = `/category/${slug}`
  const ctaLabel =
    slug === "electronics"
      ? "Shop all gadgets"
      : slug === "fashion"
        ? "Explore styles"
        : slug === "home-garden"
          ? "View collection"
          : "See more"

  // Only render slots that actually have a product image. An empty slot
  // would just be a flat gradient tile that says nothing — better to let the
  // card collapse to title + CTA when the catalog is sparse.
  const withImages = products.filter((p) => p?.image_url)

  let body: React.ReactNode = null
  switch (slug) {
    case "food-grocery": {
      // Show whatever we have, nicely. 4 → 2x2, 3 → one wide hero + two below,
      // 2 → 2x1, 1 → single big square. Never drop products to "look even".
      const items = withImages.slice(0, 4)
      if (items.length === 4) {
        body = (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {items.map((p) => (
              <Thumb key={p.product_id} product={p} className="aspect-square" />
            ))}
          </div>
        )
      } else if (items.length === 3) {
        body = (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Thumb product={items[0]} className="row-span-2 aspect-[1/2.05]" />
            <Thumb product={items[1]} className="aspect-square" />
            <Thumb product={items[2]} className="aspect-square" />
          </div>
        )
      } else if (items.length === 2) {
        body = (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {items.map((p) => (
              <Thumb key={p.product_id} product={p} className="aspect-square" />
            ))}
          </div>
        )
      } else if (items[0]) {
        body = <Thumb product={items[0]} className="aspect-square mb-4" />
      }
      break
    }
    case "electronics": {
      if (withImages[0]) {
        body = <Thumb product={withImages[0]} className="aspect-[4/5] mb-4" />
      }
      break
    }
    case "fashion": {
      const items = withImages.slice(0, 2)
      body = (
        <>
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {items.map((p) => (
                <Thumb key={p.product_id} product={p} className="aspect-square" />
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground mb-4">
            Discover curated cultural attire and modern essentials.
          </p>
        </>
      )
      break
    }
    case "home-garden":
    default:
      if (withImages[0]) {
        body = <Thumb product={withImages[0]} className="aspect-square mb-4" />
      }
  }

  return (
    <div className="bg-card p-6 border border-border flex flex-col rounded-md hover:shadow-md transition-shadow">
      <Link href={href} className="text-xl font-bold mb-4 text-foreground hover:text-foreground transition-colors">
        <h3>{category.name}</h3>
      </Link>
      {body}
      <Link
        href={href}
        className="text-foreground font-bold mt-auto flex items-center gap-1 hover:underline"
      >
        {ctaLabel} <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export function CategoriesBentoGrid({
  categories,
  productsByCategoryId,
}: CategoriesBentoGridProps) {
  // Filter out services (defensive — backend V13 already removes it, and
  // app/page.tsx also filters at the source).
  const roots = categories.filter((c) => c.slug !== "services").slice(0, 4)
  if (roots.length === 0) return null

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-5 relative z-20 mt-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {roots.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            products={productsByCategoryId[category.id] || []}
          />
        ))}
      </div>
    </section>
  )
}
