import Link from "next/link"
import { ChevronRight, Heart, MapPin, Shield, Store, Users } from "lucide-react"

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      {/* Hero */}
      <section className="text-center py-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-6">
          Our Story
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
          A marketplace built<br />
          <span className="text-primary">for immigrants, by immigrants</span>
        </h1>
        <p className="mt-5 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          When you move to a new country, you carry your culture with you — in your food, your clothes,
          your rituals. AfroTransact was born to ensure that culture stays alive, and that the entrepreneurs
          who preserve it have a place to thrive.
        </p>
      </section>

      {/* Mission */}
      <section id="mission" className="py-12 border-y border-border space-y-6">
        <h2 className="text-2xl font-bold text-white">Our Mission</h2>
        <p className="text-gray-300 leading-relaxed">
          AfroTransact exists to close the gap between immigrant communities and the authentic goods they
          need — and to empower the entrepreneurs within those communities to build sustainable businesses
          without barriers.
        </p>
        <p className="text-gray-300 leading-relaxed">
          We started in Austin, Texas, home to one of the fastest-growing immigrant populations in the
          United States. Our goal is to expand to every city where immigrant communities deserve better
          access to the products that connect them to home.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {[
            { icon: <Users className="h-6 w-6" />, color: "text-primary", bg: "bg-primary/10 border-primary/20",   title: "Community-first",    desc: "Every decision we make starts with what's best for buyers and sellers in our community." },
            { icon: <Shield className="h-6 w-6" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Transparent & fair", desc: "Clear fees, honest policies, no surprises. We succeed when our sellers succeed." },
            { icon: <Heart className="h-6 w-6" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20",   title: "Built with love",    desc: "We are ourselves immigrants and children of immigrants. This platform is personal." },
          ].map((v) => (
            <div key={v.title} className={`rounded-2xl border ${v.bg} p-5 space-y-2`}>
              <div className={v.color}>{v.icon}</div>
              <h3 className="font-bold text-white">{v.title}</h3>
              <p className="text-sm text-gray-400">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Where we operate */}
      <section className="py-12 space-y-5">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Where we operate
        </h2>
        <p className="text-gray-300 leading-relaxed">
          We currently serve the greater Austin metropolitan area across 5 cities, with delivery available
          in more neighborhoods each week. Expansion to additional Texas cities is planned — driven by where
          our community is growing.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Austin, TX", "Georgetown, TX", "Round Rock, TX", "Hutto, TX", "Leander, TX"].map((city) => (
            <span key={city} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <MapPin className="h-3.5 w-3.5" />{city}
            </span>
          ))}
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400">
            + more cities coming
          </span>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 border-t border-border">
        <div className="flex flex-wrap gap-4">
          <Link href="/search" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-header hover:bg-primary/90 transition-all">
            Start Shopping <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/sell" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10 transition-all">
            <Store className="h-4 w-4 text-primary" /> Become a Seller
          </Link>
        </div>
      </section>
    </main>
  )
}
