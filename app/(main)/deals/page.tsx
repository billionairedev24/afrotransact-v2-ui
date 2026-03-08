import Link from "next/link"
import { ChevronRight, Flame, Clock, Tag } from "lucide-react"

const DEALS = [
  { title: "🔥 Flash Sale — Spices & Herbs", discount: "Up to 40% off", ends: "Ends Sunday", tag: "Flash", tagColor: "bg-orange-500", items: 24, bg: "from-orange-950 to-orange-900", border: "border-orange-800/50" },
  { title: "🌿 Buy 2 Get 1 Free — Fresh Produce", discount: "Buy 2, get 1 free", ends: "This week only", tag: "BOGO", tagColor: "bg-emerald-600", items: 18, bg: "from-emerald-950 to-emerald-900", border: "border-emerald-800/50" },
  { title: "⭐ New Seller Spotlight — Roots & Culture", discount: "Free delivery on all orders", ends: "Limited time", tag: "Free Delivery", tagColor: "bg-blue-600", items: 12, bg: "from-blue-950 to-blue-900", border: "border-blue-800/50" },
  { title: "🎁 Starter Bundle — Nigerian Pantry", discount: "Full starter kit for $24.99", ends: "While stocks last", tag: "Bundle", tagColor: "bg-purple-600", items: 1, bg: "from-purple-950 to-purple-900", border: "border-purple-800/50" },
  { title: "🥩 Weekend Special — Meats & Seafood", discount: "10% off halal cuts", ends: "Sat & Sun only", tag: "Weekend", tagColor: "bg-red-600", items: 8, bg: "from-red-950 to-red-900", border: "border-red-800/50" },
  { title: "☕ Beverage Week — Imported Teas & Juices", discount: "15% off selected drinks", ends: "Ends Friday", tag: "15% Off", tagColor: "bg-sky-600", items: 30, bg: "from-sky-950 to-sky-900", border: "border-sky-800/50" },
]

export default function DealsPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-white">Deals</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <Flame className="h-7 w-7 text-orange-400" />
            Today&apos;s Deals
          </h1>
          <p className="text-gray-400 mt-1">Limited-time offers from immigrant-owned stores near you</p>
        </div>
        <Link href="/search?sort=discount" className="hidden sm:flex items-center gap-1 text-sm text-primary hover:text-primary/80">
          All discounted items <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEALS.map((deal) => (
          <Link
            key={deal.title}
            href="/search?sort=discount"
            className={`group rounded-2xl border ${deal.border} bg-gradient-to-br ${deal.bg} p-5 hover:scale-[1.01] transition-transform duration-200`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 text-white ${deal.tagColor}`}>
                  {deal.tag}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-white/50">
                  <Clock className="h-3 w-3" />
                  {deal.ends}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-white leading-snug">{deal.title}</h2>
                <p className="text-sm text-white/70 mt-1">{deal.discount}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-white/50">{deal.items} items</span>
                <span className="text-[12px] font-semibold text-white/80 group-hover:text-white flex items-center gap-0.5 transition-colors">
                  Shop deal <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <Tag className="h-6 w-6 text-primary mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Want to run a deal on your store?</h2>
        <p className="text-gray-400 text-sm mt-1 mb-4">Sellers can create promotions directly from their dashboard.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-header hover:bg-primary/90 transition-colors">
          Go to Seller Dashboard <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  )
}
