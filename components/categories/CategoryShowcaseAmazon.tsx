"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Loader2, Package } from "lucide-react"
import { searchProducts, type CategoryRef } from "@/lib/api"

const TINT_LIME = "bg-[#e8f5c8]"
const TINT_PEACH = "bg-[#fce5cc]"

type Cell = {
  href: string
  label: string
  image: string | null
  tint: "lime" | "peach"
}

function rootsOnly(cats: CategoryRef[]): CategoryRef[] {
  const roots = cats.filter((c) => c.parentId == null)
  if (roots.length > 0) return roots
  return cats.slice(0, 20)
}

/**
 * For each of the 4 tiles, load a product image from search filtered by that tile’s category
 * (subcategory name when present, otherwise the parent). Falls back to more products from the parent.
 */
async function fetchTileImagesForParent(parent: CategoryRef): Promise<(string | null)[]> {
  const children = (parent.children ?? []).slice(0, 4)
  const categoryPerSlot = [0, 1, 2, 3].map((i) => children[i]?.name ?? parent.name)

  const fromSlot = await Promise.all(
    categoryPerSlot.map(async (categoryName) => {
      try {
        const res = await searchProducts({ category: categoryName, size: "8" })
        const url = res.results.find((r) => r.image_url)?.image_url ?? null
        return url
      } catch {
        return null
      }
    }),
  )

  if (fromSlot.every(Boolean)) return fromSlot

  let pool: string[] = []
  try {
    const res = await searchProducts({ category: parent.name, size: "20" })
    pool = res.results.map((r) => r.image_url).filter(Boolean) as string[]
  } catch {
    /* ignore */
  }

  let j = 0
  return fromSlot.map((u) => {
    if (u) return u
    const next = pool[j++]
    return next ?? pool[0] ?? null
  })
}

function buildCells(parent: CategoryRef, tileImages: (string | null)[]): Cell[] {
  const children = (parent.children ?? []).slice(0, 4)
  const tints: ("lime" | "peach")[] = ["lime", "lime", "lime", "peach"]
  const cells: Cell[] = []

  for (let i = 0; i < 4; i++) {
    const ch = children[i]
    const img =
      tileImages[i] ?? tileImages.find((x) => x) ?? null
    if (ch) {
      cells.push({
        href: `/category/${ch.slug}`,
        label: ch.name,
        image: img,
        tint: tints[i],
      })
    } else {
      cells.push({
        href: `/category/${parent.slug}`,
        label: i === 0 ? "Shop all" : "See more",
        image: img,
        tint: tints[i],
      })
    }
  }
  return cells
}

function CategoryMegaCard({
  parent,
  cells,
  loading,
}: {
  parent: CategoryRef
  cells: Cell[] | null
  loading: boolean
}) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-gray-900 leading-tight mb-3 line-clamp-2 min-h-[2.5rem]">
        {parent.name}
      </h2>

      {loading || !cells ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md overflow-hidden">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="h-3 bg-gray-100 rounded mt-1.5 mx-1 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {cells.map((cell, idx) => (
            <Link
              key={`${cell.href}-${idx}`}
              href={cell.href}
              className="group rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div
                className={`aspect-square flex items-center justify-center p-1.5 ${
                  cell.tint === "peach" ? TINT_PEACH : TINT_LIME
                }`}
              >
                {cell.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- search/CDN URLs
                  <img
                    src={cell.image}
                    alt=""
                    className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition-transform duration-200"
                  />
                ) : (
                  <Package className="h-10 w-10 text-gray-400/70" strokeWidth={1.25} />
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-gray-800 mt-1.5 leading-snug line-clamp-2 px-0.5 group-hover:text-blue-700">
                {cell.label}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Link
        href={`/category/${parent.slug}`}
        className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
      >
        Shop {parent.name.toLowerCase()}
      </Link>
    </article>
  )
}

type ShowcaseProps = {
  categories: CategoryRef[]
  /** Max parent category cards (large tiles). */
  maxParents?: number
  className?: string
}

/**
 * Amazon-style category tiles: white cards, 2×2 image grid per parent category.
 * Each tile’s photo comes from `/api/v1/search?category=…` (products in that subcategory or parent).
 */
export function CategoryShowcaseAmazon({
  categories,
  maxParents = 12,
  className = "",
}: ShowcaseProps) {
  const roots = useMemo(() => rootsOnly(categories).slice(0, maxParents), [categories, maxParents])
  const [imagesByParentId, setImagesByParentId] = useState<Record<string, (string | null)[]>>({})
  /** undefined = before first fetch pass; empty Set = images loaded */
  const [loadingIds, setLoadingIds] = useState<Set<string> | undefined>(undefined)

  useEffect(() => {
    if (roots.length === 0) {
      setLoadingIds(new Set())
      return
    }
    let cancelled = false
    setLoadingIds(new Set(roots.map((r) => r.id)))

    void (async () => {
      const entries = await Promise.all(
        roots.map(async (parent) => {
          try {
            const tiles = await fetchTileImagesForParent(parent)
            return [parent.id, tiles] as const
          } catch {
            return [parent.id, [null, null, null, null] as (string | null)[]] as const
          }
        }),
      )
      if (cancelled) return
      const map: Record<string, (string | null)[]> = {}
      for (const [id, tiles] of entries) map[id] = tiles
      setImagesByParentId(map)
      setLoadingIds(new Set())
    })()

    return () => {
      cancelled = true
    }
  }, [roots])

  if (roots.length === 0) return null

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 ${className}`}
    >
      {roots.map((parent) => {
        const imgs = imagesByParentId[parent.id] ?? []
        const stillLoading =
          loadingIds === undefined || loadingIds.size > 0
        const cells = stillLoading ? null : buildCells(parent, imgs.length ? imgs : [null, null, null, null])
        return (
          <CategoryMegaCard
            key={parent.id}
            parent={parent}
            cells={cells}
            loading={stillLoading}
          />
        )
      })}
    </div>
  )
}

export function CategoryShowcaseLoading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
