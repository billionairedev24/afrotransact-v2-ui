import Link from "next/link"
import { MapPin, Mail, Phone } from "lucide-react"
import { StartSellingLink } from "@/components/selling/StartSellingLink"

type FooterLink = {
  label: string
  href: string
  comingSoon?: boolean
  /** Uses logged-in buyer → onboarding flow instead of guest registration. */
  isStartSelling?: boolean
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
      { label: "Start Selling", href: "/sell", isStartSelling: true },
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
    <footer className="bg-card border-t border-border pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:pb-0">
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
              <a
                href="https://www.linkedin.com/company/afrotransact"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a
                href="https://www.tiktok.com/@afrotransact"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
              <a
                href="https://www.instagram.com/afrotransact"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
              </a>
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
                    {link.isStartSelling ? (
                      <span className="inline-flex items-center gap-1.5">
                        <StartSellingLink variant="footer">{link.label}</StartSellingLink>
                      </span>
                    ) : (
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
                    )}
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
