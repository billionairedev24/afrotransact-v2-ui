import Link from "next/link"
import { MapPin, Mail, Phone } from "lucide-react"

type FooterLink = {
  label: string
  href: string
  comingSoon?: boolean
}

const footerSections: { title: string; links: FooterLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "Browse All Products", href: "/search" },
      { label: "Find Stores", href: "/stores" },
      { label: "Categories", href: "/categories" },
      { label: "Today's Deals", href: "/deals" },
      { label: "New Arrivals", href: "/search?sort=newest" },
    ],
  },
  {
    title: "For Sellers",
    links: [
      { label: "Start Selling", href: "/sell" },
      { label: "Seller Dashboard", href: "/dashboard" },
      { label: "Pricing & Plans", href: "/sell/pricing" },
      { label: "Seller Resources", href: "/coming-soon?feature=Seller Resources", comingSoon: true },
      { label: "Success Stories", href: "/coming-soon?feature=Success Stories", comingSoon: true },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Track Your Order", href: "/orders" },
      { label: "Return Policy", href: "/coming-soon?feature=Return Policy", comingSoon: true },
      { label: "Contact Us", href: "/coming-soon?feature=Contact Us", comingSoon: true },
      { label: "Report an Issue", href: "/coming-soon?feature=Report an Issue", comingSoon: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About AfroTransact", href: "/about" },
      { label: "Our Mission", href: "/about#mission" },
      { label: "Press", href: "/coming-soon?feature=Press", comingSoon: true },
      { label: "Careers", href: "/coming-soon?feature=Careers", comingSoon: true },
      { label: "Blog", href: "/coming-soon?feature=Blog", comingSoon: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Seller Agreement", href: "/seller-agreement" },
      { label: "Cookie Policy", href: "/privacy#cookies" },
    ],
  },
]

const cities = [
  "Austin, TX",
  "Georgetown, TX",
  "Round Rock, TX",
  "Hutto, TX",
  "Leander, TX",
]

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      {/* Cities bar */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              Serving:
            </span>
            {cities.map((city, i) => (
              <span key={city} className="flex items-center gap-4">
                <span className="hover:text-primary transition-colors cursor-pointer">{city}</span>
                {i < cities.length - 1 && (
                  <span className="text-border">·</span>
                )}
              </span>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground/60">
              More cities coming soon
            </span>
          </div>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1 space-y-4">
            <Link href="/" className="inline-flex items-center gap-0.5" aria-label="AfroTransact home">
              <span className="text-xl font-black text-primary">Afro</span>
              <span className="text-xl font-black text-foreground">Transact</span>
            </Link>

            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Connecting immigrant communities with authentic food, cultural products, and trusted
              local vendors across Texas.
            </p>

            <div className="space-y-1.5">
              <a
                href="mailto:hello@afrotransact.com"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                hello@afrotransact.com
              </a>
              <a
                href="tel:+15125550100"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                (512) 555-0100
              </a>
            </div>

            {/* Social */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { label: "Twitter/X", char: "𝕏" },
                { label: "Facebook", char: "f" },
                { label: "Instagram", char: "▣" },
                { label: "TikTok", char: "♪" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {s.char}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h4 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                      {link.comingSoon && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} AfroTransact, Inc. All rights reserved. Based in
            Austin, TX.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/seller-agreement" className="hover:text-foreground transition-colors">
              Seller Agreement
            </Link>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
