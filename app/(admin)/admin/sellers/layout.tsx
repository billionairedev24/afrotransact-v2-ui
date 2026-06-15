"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, Mail, AlertTriangle, FileText } from "lucide-react"

type Tab = { href: string; label: string; icon: typeof Users; match: (p: string) => boolean }

const TABS: Tab[] = [
  { href: "/admin/sellers",           label: "All Sellers", icon: Users,
    match: (p) => p === "/admin/sellers" },
  { href: "/admin/sellers/invites",   label: "Invites",     icon: Mail,
    match: (p) => p.startsWith("/admin/sellers/invites") },
  { href: "/admin/sellers/lifecycle", label: "Lifecycle",   icon: AlertTriangle,
    match: (p) => p.startsWith("/admin/sellers/lifecycle") },
  { href: "/admin/sellers/change-requests", label: "Change Requests", icon: FileText,
    match: (p) => p.startsWith("/admin/sellers/change-requests") },
]

export default function SellersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin/sellers"

  return (
    <div>
      <nav className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2">
          {TABS.map((tab) => {
            const active = tab.match(pathname)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-gold/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>
      <div>{children}</div>
    </div>
  )
}
