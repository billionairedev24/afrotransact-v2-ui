import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import {
  Package,
  MapPin,
  CreditCard,
  Settings,
  LayoutDashboard,
  Heart,
  HelpCircle,
  Bell,
  ChevronRight,
  ShoppingBag,
  Star,
  Shield,
} from "lucide-react"

export const metadata = { title: "My Account | AfroTransact" }

const menuItems = [
  {
    href: "/orders",
    label: "Your Orders",
    desc: "Track, return, or buy things again",
    icon: Package,
    accent: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
  },
  {
    href: "/account/addresses",
    label: "Addresses",
    desc: "Edit addresses for orders & deliveries",
    icon: MapPin,
    accent: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
  },
  {
    href: "/account/payments",
    label: "Payment Methods",
    desc: "Manage cards & payment options",
    icon: CreditCard,
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
  },
  {
    href: "/account/notifications",
    label: "Notifications",
    desc: "Control what emails you receive",
    icon: Bell,
    accent: "#ec4899",
    bg: "rgba(236,72,153,0.08)",
  },
  {
    href: "/account/settings",
    label: "Account Settings",
    desc: "Name, email & password",
    icon: Settings,
    accent: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
  },
  {
    href: "/account/wishlist",
    label: "Wishlist",
    desc: "Products you've saved for later",
    icon: Heart,
    accent: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
  },
  {
    href: "/help",
    label: "Help & Support",
    desc: "Get help with your account",
    icon: HelpCircle,
    accent: "#06b6d4",
    bg: "rgba(6,182,212,0.08)",
  },
]

function getInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

function getMemberSince(): string {
  // Placeholder — ideally sourced from session/token createdAt
  const year = new Date().getFullYear()
  return `Member since ${year}`
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/account")
  }

  const roles: string[] = session.user?.roles ?? []
  const isSeller = roles.includes("seller")
  const initials = getInitials(session.user?.name)

  return (
    <main className="min-h-screen bg-background">
      {/* Hero / Profile Header */}
      <div className="relative overflow-hidden border-b border-border bg-card">
        {/* Decorative gradient blob */}
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -top-12 right-0 h-56 w-56 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl text-3xl sm:text-4xl font-black text-[#0f0f10] shadow-xl"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
                }}
              >
                {initials}
              </div>
              {isSeller && (
                <div
                  className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full text-[10px]"
                  style={{ background: "hsl(var(--primary))", color: "#0f0f10" }}
                  title="Verified Seller"
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                </div>
              )}
            </div>

            {/* Name & info */}
            <div className="text-center sm:text-left space-y-1 pb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {session.user?.name ?? "Your Account"}
              </h1>
              <p className="text-sm text-muted-foreground">{session.user?.email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  {getMemberSince()}
                </span>
                {isSeller && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <ShoppingBag className="h-3 w-3" />
                    Seller Account
                  </span>
                )}
              </div>
            </div>

            {/* Seller dashboard CTA */}
            {isSeller && (
              <div className="sm:ml-auto pb-1">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-[#0f0f10] shadow-lg shadow-primary/25 transition-all hover:brightness-110 hover:-translate-y-0.5"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Seller Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Account Overview
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
              >
                {/* Icon */}
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: item.bg }}
                >
                  <Icon className="h-5 w-5" style={{ color: item.accent }} />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.desc}</p>
                </div>

                {/* Chevron */}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>

        {/* Quick tip */}
        <p className="mt-8 text-center text-xs text-muted-foreground/50">
          Need to change your name or email? Visit{" "}
          <Link href="/account/settings" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            Account Settings
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
