import Link from "next/link"
import {
  ChevronRight,
  MapPin,
  Star,
  Store,
  Truck,
  ShieldCheck,
  Users,
  Leaf,
  Flame,
  Beef,
  Cookie,
  Cpu,
  Shirt,
  Wine,
  Package,
  TrendingUp,
  Clock,
  Sparkles,
  Tag,
  Gift,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileNav } from "@/components/layout/mobile-nav"
import { HeroCarousel } from "@/components/home/HeroCarousel"
import { AdSlot } from "@/components/home/AdSlot"
import { FeaturedProducts } from "@/components/home/FeaturedProducts"

/* ─── Static data (will be replaced with real API calls) ─── */

const categories = [
  {
    name: "Fresh Produce",
    icon: Leaf,
    description: "Farm-fresh fruits & vegetables",
    href: "/category/produce",
    bg: "from-emerald-950 to-emerald-900",
    border: "border-emerald-800/50",
    iconColor: "text-emerald-400",
    badge: "In stock",
    badgeColor: "bg-emerald-500/20 text-emerald-300",
  },
  {
    name: "Spices & Herbs",
    icon: Flame,
    description: "Authentic seasonings from home",
    href: "/category/spices",
    bg: "from-orange-950 to-orange-900",
    border: "border-orange-800/50",
    iconColor: "text-orange-400",
    badge: "Best seller",
    badgeColor: "bg-orange-500/20 text-orange-300",
  },
  {
    name: "Meats & Seafood",
    icon: Beef,
    description: "Halal, Kosher & specialty cuts",
    href: "/category/meats",
    bg: "from-red-950 to-red-900",
    border: "border-red-800/50",
    iconColor: "text-red-400",
    badge: "Fresh daily",
    badgeColor: "bg-red-500/20 text-red-300",
  },
  {
    name: "Baked Goods",
    icon: Cookie,
    description: "Breads, pastries & sweet treats",
    href: "/category/baked",
    bg: "from-amber-950 to-amber-900",
    border: "border-amber-800/50",
    iconColor: "text-amber-400",
    badge: "Homemade",
    badgeColor: "bg-amber-500/20 text-amber-300",
  },
  {
    name: "Beverages",
    icon: Wine,
    description: "Teas, juices & cultural drinks",
    href: "/category/beverages",
    bg: "from-sky-950 to-sky-900",
    border: "border-sky-800/50",
    iconColor: "text-sky-400",
    badge: "Imported",
    badgeColor: "bg-sky-500/20 text-sky-300",
  },
  {
    name: "Fashion",
    icon: Shirt,
    description: "Traditional & modern clothing",
    href: "/category/fashion",
    bg: "from-purple-950 to-purple-900",
    border: "border-purple-800/50",
    iconColor: "text-purple-400",
    badge: "Handcrafted",
    badgeColor: "bg-purple-500/20 text-purple-300",
  },
  {
    name: "Electronics",
    icon: Cpu,
    description: "Phones, accessories & more",
    href: "/category/electronics",
    bg: "from-blue-950 to-blue-900",
    border: "border-blue-800/50",
    iconColor: "text-blue-400",
    badge: "New arrivals",
    badgeColor: "bg-blue-500/20 text-blue-300",
  },
  {
    name: "Pantry & Dry Goods",
    icon: Package,
    description: "Grains, legumes & staples",
    href: "/category/pantry",
    bg: "from-yellow-950 to-yellow-900",
    border: "border-yellow-800/50",
    iconColor: "text-yellow-400",
    badge: "Bulk deals",
    badgeColor: "bg-yellow-500/20 text-yellow-300",
  },
]


const topStores = [
  {
    name: "Mama's Market",
    type: "West African Grocery",
    rating: 4.8,
    reviews: 312,
    distance: "0.3 mi",
    deliveryTime: "25–40 min",
    categories: ["Produce", "Spices", "Dry Goods"],
    openNow: true,
  },
  {
    name: "Accra Foods",
    type: "Ghanaian Specialty",
    rating: 4.6,
    reviews: 189,
    distance: "0.5 mi",
    deliveryTime: "30–45 min",
    categories: ["Meats", "Spices", "Pastries"],
    openNow: true,
  },
  {
    name: "Naija Pantry",
    type: "Nigerian Grocery",
    rating: 4.9,
    reviews: 441,
    distance: "0.8 mi",
    deliveryTime: "35–50 min",
    categories: ["Spices", "Snacks", "Beverages"],
    openNow: false,
  },
]

const deals = [
  { label: "🔥 Flash Sale", detail: "Spices up to 40% off", color: "bg-orange-900 border-orange-700" },
  { label: "🌿 Fresh Produce Week", detail: "Buy 2 get 1 free", color: "bg-emerald-900 border-emerald-700" },
  { label: "⭐ New Seller Spotlight", detail: "Roots & Culture — free delivery", color: "bg-blue-900 border-blue-700" },
  { label: "🎁 Weekend Bundle", detail: "Starter pack — $24.99", color: "bg-purple-900 border-purple-700" },
]

const trustPoints = [
  {
    icon: Users,
    title: "Community-Owned",
    body: "Every vendor is a member of your immigrant community. Your purchase directly supports a neighbor.",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  {
    icon: ShieldCheck,
    title: "Verified & Trusted",
    body: "All sellers are identity-verified and held to our quality standards. Shop with complete confidence.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Truck,
    title: "Same-Day Local Delivery",
    body: "Orders placed before 2 PM delivered today across Austin, Georgetown, Round Rock, and Leander.",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
]

/* ─── Page ─── */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pb-16 md:pb-0">

        {/* ── Hero Carousel ── */}
        <HeroCarousel />

        {/* ── Deals strip ── */}
        <section className="bg-card/70 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              <span className="shrink-0 text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Today&apos;s Deals
              </span>
              <span className="w-px h-5 bg-border shrink-0" />
              {deals.map((deal) => (
                <Link
                  key={deal.label}
                  href="/deals"
                    className={`shrink-0 flex items-center gap-2 rounded-lg border ${deal.color} px-3 py-1.5 text-xs font-medium text-white/90 hover:brightness-110 transition-all`}
                >
                  <span>{deal.label}</span>
                  <span className="text-white/70">·</span>
                  <span className="text-white/80">{deal.detail}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ad Slot 1: Free delivery promo ── */}
        <AdSlot slotId="mid-page-1" />

        {/* ── Shop by Category ── */}
        <section className="bg-card/40 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Shop by Category</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Everything you need, all in one place
                </p>
              </div>
              <Link
                href="/categories"
                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {categories.map((cat) => {
                const Icon = cat.icon
                return (
                  <Link
                    key={cat.name}
                    href={cat.href}
                    className={`group relative overflow-hidden rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.bg} p-5 hover:scale-[1.02] transition-transform duration-200 active:scale-[0.99]`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                          <Icon className={`h-5 w-5 ${cat.iconColor}`} strokeWidth={1.75} />
                        </div>
                        <span
                          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${cat.badgeColor}`}
                        >
                          {cat.badge}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm leading-tight">
                          {cat.name}
                        </h3>
                        <p className="text-[11px] text-white/60 mt-0.5">{cat.description}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-white/50 group-hover:text-white/80 transition-colors">
                        <span>Shop now</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Near You — fetched from search API ── */}
        <FeaturedProducts />

        {/* ── Ad Slot 2: Vendor CTA (mid-page dismissible) ── */}
        <AdSlot slotId="mid-page-2" />

        {/* ── Top Stores ── */}
        <section className="bg-card/40 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Top Stores Near You</h2>
                <p className="text-sm text-muted-foreground mt-1">Highest-rated vendors in Austin</p>
              </div>
              <Link
                href="/stores"
                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                All stores <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {topStores.map((store, i) => (
                <Link
                  key={store.name}
                  href={`/store/${store.name.toLowerCase().replace(/\s+/g, "-")}`}
                  className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                >
                  {/* Store banner */}
                  <div
                    className="h-28 relative"
                    style={{
                      background: [
                        "linear-gradient(135deg, #1a2e1a, #0f1f0f)",
                        "linear-gradient(135deg, #2e1a1a, #1f0f0f)",
                        "linear-gradient(135deg, #1a1a2e, #0f0f1f)",
                      ][i % 3],
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <Store className="h-16 w-16 text-white" />
                    </div>
                    {/* Open badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          store.openNow
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {store.openNow ? "Open" : "Closed"}
                      </span>
                    </div>
                    {/* Store avatar */}
                    <div className="absolute -bottom-5 left-4 h-12 w-12 rounded-xl bg-card border-2 border-border flex items-center justify-center">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                  </div>

                  <div className="pt-8 px-4 pb-4 space-y-2">
                    <div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {store.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{store.type}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        {store.rating}
                        <span className="text-muted-foreground font-normal">({store.reviews})</span>
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {store.distance}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {store.deliveryTime}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {store.categories.map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust / Why AfroTransact ── */}
        <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Why thousands of immigrants shop with us
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              More than a marketplace — a bridge between your new home and your roots.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {trustPoints.map((point) => {
              const Icon = point.icon
              return (
                <div
                  key={point.title}
                  className={`rounded-2xl border ${point.bg} p-6 space-y-3`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${point.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-[17px] font-bold text-foreground">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Ad Slot 3: Referral strip before vendor CTA ── */}
        <AdSlot slotId="bottom-strip" />

        {/* ── Vendor CTA ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-card to-secondary/10 border-y border-border">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-5"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(212,168,83,0.4) 0%, transparent 50%), " +
                "radial-gradient(circle at 80% 50%, rgba(34,197,94,0.3) 0%, transparent 50%)",
            }}
          />
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-16 relative">
            <div className="max-w-2xl mx-auto text-center space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Store className="h-3 w-3" />
                For Vendors
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight">
                Turn your passion into{" "}
                <span className="text-primary">a thriving business</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Join 200+ immigrant entrepreneurs already selling on AfroTransact. Set up your store in
                minutes, reach thousands of customers in Austin, and grow on your own terms.
              </p>

              {/* Pricing teaser */}
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-2">
                {[
                  { name: "Starter", price: "$29.99", tag: "Most popular" },
                  { name: "Growth",  price: "$79.99", tag: "Scale faster"  },
                  { name: "Pro",     price: "$149.99", tag: "Full power"   },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-center"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{plan.name}</p>
                    <p className="text-sm font-bold text-gray-900">{plan.price}<span className="text-[10px] font-normal text-gray-400">/mo</span></p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">{plan.tag}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-semibold">First month free.</span>{" "}
                Second month free if you list 9+ products. Then pay monthly.
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Link
                  href="/sell"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  Start Selling Today
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sell/pricing"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-gray-300 bg-white px-8 text-[15px] font-semibold text-gray-900 hover:bg-gray-50 transition-all"
                >
                  View Pricing
                </Link>
              </div>

              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                {[
                  { icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />, text: "No hidden fees" },
                  { icon: <Sparkles className="h-4 w-4 text-primary" />, text: "1st month free" },
                  { icon: <Gift className="h-4 w-4 text-violet-400" />, text: "Free onboarding support" },
                  { icon: <Tag className="h-4 w-4 text-sky-400" />, text: "Cancel anytime" },
                ].map(({ icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5">
                    {icon}
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <MobileNav />
    </div>
  )
}
