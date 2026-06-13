import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { CategoryRef } from "@/lib/api"

/**
 * Amazon-style category cards — each root category renders as a card
 * containing up to 4 sub-category tiles. Each tile shows a representative
 * product image with the sub-category label underneath, NOT a bare product
 * thumbnail. Clicking a tile goes to the sub-category page; clicking the
 * card footer link goes to the root category page.
 *
 * Empty tile (image=null) is dropped entirely — we never render a flat
 * gradient placeholder. Card collapses to title + CTA when nothing is
 * indexed yet.
 *
 * Tile data is precomputed server-side in app/page.tsx so this stays a
 * pure server component with zero client JS.
 */

const TILE_BG = "bg-gradient-to-br from-amber-50 to-orange-100"

export type BentoTile = {
  label: string
  categorySlug: string
  image: string | null
  productSlug?: string
}

interface CategoriesBentoGridProps {
  categories: CategoryRef[]
  tilesByRoot: Record<string, BentoTile[]>
}

function Tile({ tile }: { tile: BentoTile }) {
  if (!tile.image) return null
  return (
    <Link
      href={`/category/${tile.categorySlug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded"
      aria-label={tile.label}
    >
      <div
        className={`relative aspect-square rounded overflow-hidden ${TILE_BG} hover:ring-2 hover:ring-brand-gold transition-shadow`}
      >
        <Image
          src={tile.image}
          alt={tile.label}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain p-2 transition-transform group-hover:scale-[1.03]"
        />
      </div>
      <p className="mt-1.5 text-xs text-gray-700 leading-snug line-clamp-2 group-hover:text-foreground">
        {tile.label}
      </p>
    </Link>
  )
}

function CategoryCard({
  category,
  tiles,
}: {
  category: CategoryRef
  tiles: BentoTile[]
}) {
  const href = `/category/${category.slug}`
  const ctaLabel =
    category.slug === "electronics"
      ? "Shop all gadgets"
      : category.slug === "fashion"
        ? "Explore styles"
        : category.slug === "home-garden"
          ? "View collection"
          : "See more"

  const usable = tiles.filter((t) => t.image).slice(0, 4)

  // Layout: 4 → 2x2, 3 → 2x1 plus a single below, 2 → 2x1, 1 → single big.
  // Never drop tiles to "look even" — sellers add a 3rd product, we show 3.
  let grid: React.ReactNode = null
  if (usable.length >= 4) {
    grid = (
      <div className="grid grid-cols-2 gap-3 mb-4">
        {usable.slice(0, 4).map((t, i) => (
          <Tile key={`${t.categorySlug}-${i}`} tile={t} />
        ))}
      </div>
    )
  } else if (usable.length === 3) {
    grid = (
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Tile tile={usable[0]} />
          <Tile tile={usable[1]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile tile={usable[2]} />
        </div>
      </div>
    )
  } else if (usable.length === 2) {
    grid = (
      <div className="grid grid-cols-2 gap-3 mb-4">
        {usable.map((t, i) => (
          <Tile key={`${t.categorySlug}-${i}`} tile={t} />
        ))}
      </div>
    )
  } else if (usable.length === 1) {
    grid = (
      <div className="mb-4">
        <Tile tile={usable[0]} />
      </div>
    )
  }

  return (
    <div className="bg-card p-5 border border-border flex flex-col rounded-md hover:shadow-md transition-shadow">
      <Link
        href={href}
        className="text-lg font-bold mb-4 text-foreground hover:text-foreground transition-colors"
      >
        <h3>{category.name}</h3>
      </Link>
      {grid}
      <Link
        href={href}
        className="text-foreground font-bold mt-auto flex items-center gap-1 text-sm hover:underline"
      >
        {ctaLabel} <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export function CategoriesBentoGrid({
  categories,
  tilesByRoot,
}: CategoriesBentoGridProps) {
  const roots = categories.filter((c) => c.slug !== "services").slice(0, 4)
  if (roots.length === 0) return null

  // Hide the entire row if no root has any tile to show. Beats rendering a
  // grid of empty cards on a cold catalog.
  const totalTiles = roots.reduce((n, c) => n + (tilesByRoot[c.id]?.length ?? 0), 0)
  if (totalTiles === 0) return null

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-5 relative z-20 mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roots.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            tiles={tilesByRoot[category.id] ?? []}
          />
        ))}
      </div>
    </section>
  )
}
