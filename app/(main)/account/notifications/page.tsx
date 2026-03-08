"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import { Bell, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getUserProfile, API_BASE } from "@/lib/api"

interface NotificationPrefs {
  order_updates: boolean
  promotions: boolean
  product_reviews: boolean
  seller_updates: boolean
  newsletter: boolean
}

const PREF_ITEMS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: "order_updates", label: "Order Updates", desc: "Order confirmations, shipping updates, and delivery notifications" },
  { key: "promotions", label: "Promotions & Deals", desc: "Exclusive discounts and limited-time offers" },
  { key: "product_reviews", label: "Review Reminders", desc: "Reminders to review products you've purchased" },
  { key: "seller_updates", label: "Seller Updates", desc: "New products from stores you follow" },
  { key: "newsletter", label: "Newsletter", desc: "Weekly roundup of what's new on AfroTransact" },
]

const DEFAULT_PREFS: NotificationPrefs = {
  order_updates: true,
  promotions: true,
  product_reviews: true,
  seller_updates: false,
  newsletter: false,
}

export default function NotificationPreferencesPage() {
  const { status } = useSession()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const profile = await getUserProfile(token)
        if (cancelled) return
        if (profile.preferences) {
          try {
            const parsed = typeof profile.preferences === "string" ? JSON.parse(profile.preferences) : profile.preferences
            if (parsed.notifications) {
              setPrefs((prev) => ({ ...prev, ...parsed.notifications }))
            }
          } catch { /* use defaults */ }
        }
      } catch { /* use defaults */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [status])

  async function handleSave() {
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const profile = await getUserProfile(token)
      let existing: Record<string, unknown> = {}
      if (profile.preferences) {
        try {
          existing = typeof profile.preferences === "string" ? JSON.parse(profile.preferences) : profile.preferences
        } catch { /* ignore */ }
      }

      const updated = JSON.stringify({ ...existing, notifications: prefs })

      const res = await fetch(`${API_BASE}/api/v1/users/me/preferences`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: updated,
      })
      if (!res.ok) throw new Error("Failed to save")

      toast.success("Notification preferences saved")
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  function toggle(key: keyof NotificationPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading preferences...
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/account" className="rounded-lg p-2 hover:bg-white/5 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-pink-400" />
            Notification Preferences
          </h1>
          <p className="text-sm text-gray-400 mt-1">Choose what notifications you receive</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 divide-y divide-white/5" style={{ background: "hsl(0 0% 11%)" }}>
        {PREF_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0 pr-4">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                prefs[item.key] ? "bg-primary" : "bg-white/15"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  prefs[item.key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Preferences
        </button>
      </div>
    </main>
  )
}
