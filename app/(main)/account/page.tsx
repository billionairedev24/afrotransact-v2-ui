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
} from "lucide-react"

export const metadata = { title: "My Account | AfroTransact" }

const menuItems = [
  { href: "/orders", label: "Your Orders", desc: "Track, return, or buy things again", icon: Package, accent: "#4ade80" },
  { href: "/account/addresses", label: "Addresses", desc: "Edit addresses for orders", icon: MapPin, accent: "#60a5fa" },
  { href: "/account/payments", label: "Payment Methods", desc: "Manage payment methods", icon: CreditCard, accent: "#fbbf24" },
  { href: "/account/notifications", label: "Notification Preferences", desc: "Control what emails you receive", icon: Bell, accent: "#f472b6" },
  { href: "/account/settings", label: "Account Settings", desc: "Name, email, password", icon: Settings, accent: "#a78bfa" },
  { href: "/account/wishlist", label: "Wishlist", desc: "Products you've saved", icon: Heart, accent: "#f87171" },
  { href: "/help", label: "Help & Support", desc: "Get help with your account", icon: HelpCircle, accent: "#67e8f9" },
]

function getInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/account")
  }

  const roles: string[] = session.user?.roles ?? []
  const isSeller = roles.includes("seller")

  return (
    <main className="mx-auto max-w-[960px] px-4 sm:px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-[#0f0f10]">
          {getInitials(session.user?.name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{session.user?.name ?? "Your Account"}</h1>
          <p className="text-sm text-gray-400">{session.user?.email}</p>
        </div>
      </div>

      {isSeller && (
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors"
          >
            <LayoutDashboard className="h-3 w-3" />
            Go to Seller Dashboard
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-4 rounded-xl border border-white/10 p-5 transition-colors hover:border-white/20 hover:bg-white/[0.03]"
              style={{ background: "hsl(0 0% 11%)" }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${item.accent}18` }}
              >
                <Icon className="h-5 w-5" style={{ color: item.accent }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
