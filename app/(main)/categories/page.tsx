import Link from "next/link"
import { ChevronRight, Beef, Cookie, Cpu, Flame, Home, Leaf, Package, Shirt, Wine } from "lucide-react"

const CATEGORIES = [
  { name: "Fresh Produce",    slug: "produce",    icon: Leaf,    desc: "Farm-fresh fruits, vegetables & herbs",   count: 420, bg: "from-emerald-950 to-emerald-900", border: "border-emerald-800/50", iconColor: "text-emerald-400" },
  { name: "Spices & Herbs",   slug: "spices",     icon: Flame,   desc: "Authentic seasonings from around the world",count: 310, bg: "from-orange-950 to-orange-900",  border: "border-orange-800/50",  iconColor: "text-orange-400"  },
  { name: "Meats & Seafood",  slug: "meats",      icon: Beef,    desc: "Halal, Kosher & specialty cuts",          count: 185, bg: "from-red-950 to-red-900",         border: "border-red-800/50",     iconColor: "text-red-400"     },
  { name: "Baked Goods",      slug: "baked",      icon: Cookie,  desc: "Breads, pastries & homemade treats",      count: 140, bg: "from-amber-950 to-amber-900",     border: "border-amber-800/50",   iconColor: "text-amber-400"   },
  { name: "Beverages",        slug: "beverages",  icon: Wine,    desc: "Imported teas, juices & cultural drinks", count: 200, bg: "from-sky-950 to-sky-900",         border: "border-sky-800/50",     iconColor: "text-sky-400"     },
  { name: "Fashion",          slug: "fashion",    icon: Shirt,   desc: "Traditional & modern clothing",           count: 95,  bg: "from-purple-950 to-purple-900",   border: "border-purple-800/50",  iconColor: "text-purple-400"  },
  { name: "Electronics",      slug: "electronics",icon: Cpu,     desc: "Phones, accessories & gadgets",           count: 78,  bg: "from-blue-950 to-blue-900",       border: "border-blue-800/50",    iconColor: "text-blue-400"    },
  { name: "Pantry & Dry Goods",slug:"pantry",     icon: Package, desc: "Grains, legumes, rice & staples",        count: 360, bg: "from-yellow-950 to-yellow-900",   border: "border-yellow-800/50",  iconColor: "text-yellow-400"  },
  { name: "Home & Living",    slug: "home",       icon: Home,    desc: "Décor, kitchenware & cultural items",     count: 60,  bg: "from-violet-950 to-violet-900",   border: "border-violet-800/50",  iconColor: "text-violet-400"  },
]

export default function CategoriesPage() {
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`group relative overflow-hidden rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.bg} p-5 hover:scale-[1.01] transition-transform duration-200`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className={`h-6 w-6 ${cat.iconColor}`} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-white leading-tight">{cat.name}</h2>
                  <p className="text-[12px] text-white/60 mt-0.5 line-clamp-1">{cat.desc}</p>
                  <p className="text-[11px] text-white/40 mt-2">{cat.count} products</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/70 transition-colors shrink-0 mt-0.5" />
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
