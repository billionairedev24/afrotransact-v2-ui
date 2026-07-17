"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AccountShell } from "@/components/account/AccountShell"
import { getAccessToken } from "@/lib/auth-helpers"
import { getUserProfile, API_BASE } from "@/lib/api"

interface NotificationPrefs {
  order_updates: boolean
  promotions: boolean
  product_reviews: boolean
  seller_updates: boolean
  newsletter: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  order_updates: true,
  promotions: true,
  product_reviews: true,
  seller_updates: false,
  newsletter: false,
}

const ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "order_updates",   label: "Order updates",        description: "Confirmations, shipping tracking, and delivery alerts" },
  { key: "promotions",      label: "Promotions and deals", description: "Exclusive discounts and limited-time offers" },
  { key: "product_reviews", label: "Review reminders",     description: "Nudges to review products after they arrive" },
  { key: "seller_updates",  label: "Stores you follow",    description: "When stores you follow add new products" },
  { key: "newsletter",      label: "Weekly newsletter",    description: "A curated roundup of what's trending on AfroTransact" },
]

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-50 ${
        checked ? "bg-brand-gold" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  )
}

export function NotificationsSection() {
  const { status } = useSession()
  const router = useRouter()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // If the initial load fails we must NOT show the default toggles as if they
  // were the user's real prefs — a save would then overwrite their real
  // settings with defaults. Surface an error and block editing until reload.
  const [loadError, setLoadError] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login?callbackUrl=/account")
  }, [status, router])

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
          const parsed =
            typeof profile.preferences === "string"
              ? JSON.parse(profile.preferences)
              : profile.preferences
          if (parsed?.notifications) setPrefs((p) => ({ ...p, ...parsed.notifications }))
        }
      } catch {
        // Do NOT silently fall back to defaults — flag the failure so we don't
        // let the user save default toggles over their real preferences.
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [status])

  async function savePrefs(updated: NotificationPrefs) {
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const profile = await getUserProfile(token)
      let existing: Record<string, unknown> = {}
      if (profile.preferences) {
        try {
          existing =
            typeof profile.preferences === "string"
              ? JSON.parse(profile.preferences)
              : profile.preferences
        } catch {
          // ignore
        }
      }
      const res = await fetch(`${API_BASE}/api/v1/users/me/preferences`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...existing, notifications: updated }),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Preferences saved")
    } catch {
      toast.error("Could not save preferences")
    } finally {
      setSaving(false)
    }
  }

  function toggle(key: keyof NotificationPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => savePrefs(updated), 600)
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your preferences…
          </div>
        ) : loadError ? (
          <div className="px-5 py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t load your notification preferences right now. Please try again — we don&apos;t want a save to overwrite your saved settings.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {ITEMS.map((item) => (
              <li key={item.key} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Toggle
                  checked={prefs[item.key]}
                  onChange={() => toggle(item.key)}
                  disabled={saving}
                  label={item.label}
                />
              </li>
            ))}
          </ul>
        )}
        {saving && (
          <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Order confirmations and shipping alerts are operational messages and may still be sent even if the
        toggle is off, so you don&apos;t miss critical updates about a purchase.
      </p>
    </>
  )
}

export default function NotificationsPage() {
  return (
    <AccountShell
      title="Notifications"
      subtitle="Choose which emails you want to receive. Changes save automatically."
    >
      <NotificationsSection />
    </AccountShell>
  )
}
