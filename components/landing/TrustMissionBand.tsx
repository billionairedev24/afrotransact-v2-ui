import { Users, ShieldCheck, Truck } from "lucide-react"

/**
 * Trust & mission band (ported from public/ux-designs/code.html lines 327–358).
 * White band, 3 icon+text columns with brand-gold accent ring on icon.
 */
const POINTS = [
  {
    Icon: Users,
    title: "Community-Owned",
    body: "Driven by a collective of local entrepreneurs, ensuring fair profits and local reinvestment.",
  },
  {
    Icon: ShieldCheck,
    title: "Verified & Trusted",
    body: "Every seller undergoes a strict quality and authenticity check to guarantee genuine goods.",
  },
  {
    Icon: Truck,
    title: "Local Fast Delivery",
    body: "Enjoy same-day delivery on grocery and essential items within participating city centers.",
  },
]

export function TrustMissionBand() {
  return (
    <section className="bg-card border-y border-border py-12">
      <div className="max-w-page mx-auto px-4 sm:px-5 grid grid-cols-1 md:grid-cols-3 gap-12">
        {POINTS.map(({ Icon, title, body }) => (
          <div key={title} className="flex gap-4 items-start">
            <div className="bg-primary/20 p-3 rounded-full flex-shrink-0">
              <Icon className="h-7 w-7 text-foreground" strokeWidth={2.25} />
            </div>
            <div>
              <h4 className="text-xl font-bold mb-2 text-foreground">{title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
