"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Beef,
  Cookie,
  Cpu,
  Flame,
  Home,
  Leaf,
  Package,
  Shirt,
  Wine,
  Loader2,
} from "lucide-react"
import { getCategories, type CategoryRef } from "@/lib/api"

const STYLE_MAP: Record<string, { icon: typeof Leaf; bg: string; border: string; iconColor: string }> = {
  produce:     { icon: Leaf,    bg: "from-emerald-950 to-emerald-900", border: "border-emerald-800/50", iconColor: "text-emerald-400" },
  spices:      { icon: Flame,   bg: "from-orange-950 to-orange-900",  border: "border-orange-800/50",  iconColor: "text-orange-400"  },
  meats:       { icon: Beef,    bg: "from-red-950 to-red-900",        border: "border-red-800/50",     iconColor: "text-red-400"     },
  baked:       { icon: Cookie,  bg: "from-amber-950 to-amber-900",    border: "border-amber-800/50",   iconColor: "text-amber-400"   },
  beverages:   { icon: Wine,    bg: "from-sky-950 to-sky-900",        border: "border-sky-800/50",     iconColor: "text-sky-400"     },
  fashion:     { icon: Shirt,   bg: "from-purple-950 to-purple-900",  border: "border-purple-800/50",  iconColor: "text-purple-400"  },
  electronics: { icon: Cpu,     bg: "from-blue-950 to-blue-900",      border: "border-blue-800/50",    iconColor: "text-blue-400"    },
  pantry:      { icon: Package, bg: "from-yellow-950 to-yellow-900",  border: "border-yellow-800/50",  iconColor: "text-yellow-400"  },
  home:        { icon: Home,    bg: "from-violet-950 to-violet-900",  border: "border-violet-800/50",  iconColor: "text-violet-400"  },
}

const DEFAULT_STYLE = {
  icon: Package,
  bg: "from-gray-900 to-gray-800",
  border: "border-gray-700/50",
  iconColor: "text-gray-400",
}

function getStyle(slug: string) {
  const key = Object.keys(STYLE_MAP).find((k) => slug.toLowerCase().includes(k))
  return key ? STYLE_MAP[key] : DEFAULT_STYLE
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">Categories</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">All Categories</h1>
        <p className="text-gray-500 mt-1">Browse everything available from immigrant-owned stores near you</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : categories.length === 0 ? (
        <p className="text-center text-gray-500 py-20">No categories available yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const style = getStyle(cat.slug)
            const Icon = style.icon
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className={`group relative overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} p-5 hover:scale-[1.01] transition-transform duration-200`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className={`h-6 w-6 ${style.iconColor}`} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-white leading-tight">{cat.name}</h2>
                    {cat.children && cat.children.length > 0 && (
                      <p className="text-[12px] text-white/60 mt-0.5 line-clamp-1">
                        {cat.children.map((c) => c.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/70 transition-colors shrink-0 mt-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
