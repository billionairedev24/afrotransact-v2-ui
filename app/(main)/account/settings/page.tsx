"use client"

import { useState, useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, User, Mail, Lock, Eye, EyeOff, CheckCircle2,
  AlertCircle, Loader2, ShieldAlert, X, ChevronRight,
  Bell, ToggleLeft, ToggleRight,
} from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { getUserProfile, API_BASE } from "@/lib/api"

// ─── Reusable Toggle ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
        style={{ width: "18px", height: "18px" }}
      />
    </button>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ id, title, subtitle, children }: {
  id: string; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ─── Password change form ─────────────────────────────────────────────────────

function PasswordSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() { setCurrent(""); setNext(""); setConfirm(""); setOpen(false) }

  const strength = next.length === 0 ? 0 : next.length < 8 ? 1 : next.length < 12 ? 2 : /[A-Z]/.test(next) && /[0-9]/.test(next) && /[^a-zA-Z0-9]/.test(next) ? 4 : 3
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"]
  const strengthColor = ["", "bg-red-500", "bg-amber-400", "bg-blue-500", "bg-emerald-500"]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { toast.error("Passwords do not match"); return }
    if (next.length < 8) { toast.error("Password must be at least 8 characters"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Password updated successfully")
        reset()
      } else {
        toast.error(body.error ?? "Failed to update password")
      }
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition"

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
            <Lock className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Password</p>
            <p className="text-xs text-gray-400 mt-0.5">Last changed: unknown</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
        >
          {open ? "Cancel" : "Change"}
          {!open && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-gray-50/50 px-5 py-5 space-y-4">
          {/* Current password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="Enter your current password"
                className={inputCls}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">New Password</label>
            <div className="relative">
              <input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={e => setNext(e.target.value)}
                placeholder="At least 8 characters"
                className={inputCls}
                required
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {next.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor[strength] : "bg-gray-200"}`} />
                  ))}
                </div>
                <p className={`text-[11px] font-medium ${strength <= 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : strength === 3 ? "text-blue-500" : "text-emerald-500"}`}>
                  {strengthLabel[strength]}
                </p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Confirm New Password</label>
            <div className="relative">
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className={`${inputCls} ${confirm && next && confirm !== next ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
                required
                autoComplete="new-password"
              />
              {confirm && next && confirm === next && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              )}
            </div>
            {confirm && next && confirm !== next && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 transition">Cancel</button>
            <button
              type="submit"
              disabled={saving || !current || !next || !confirm}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-black transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Notifications section ────────────────────────────────────────────────────

interface NotificationPrefs {
  order_updates: boolean
  promotions: boolean
  product_reviews: boolean
  seller_updates: boolean
  newsletter: boolean
}

const NOTIF_ITEMS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: "order_updates", label: "Order Updates", desc: "Confirmations, shipping tracking, and delivery alerts" },
  { key: "promotions", label: "Promotions & Deals", desc: "Exclusive discounts and limited-time offers from stores you like" },
  { key: "product_reviews", label: "Review Reminders", desc: "Friendly nudges to review products after they arrive" },
  { key: "seller_updates", label: "Seller Updates", desc: "New products from stores you follow" },
  { key: "newsletter", label: "Weekly Newsletter", desc: "A curated roundup of what's trending on AfroTransact" },
]

const DEFAULT_PREFS: NotificationPrefs = {
  order_updates: true,
  promotions: true,
  product_reviews: true,
  seller_updates: false,
  newsletter: false,
}

function NotificationsSection() {
  const { status } = useSession()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          const parsed = typeof profile.preferences === "string" ? JSON.parse(profile.preferences) : profile.preferences
          if (parsed?.notifications) setPrefs(p => ({ ...p, ...parsed.notifications }))
        }
      } catch { /* use defaults */ }
      finally { if (!cancelled) setLoading(false) }
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
        try { existing = typeof profile.preferences === "string" ? JSON.parse(profile.preferences) : profile.preferences } catch { /**/ }
      }
      await fetch(`${API_BASE}/api/v1/users/me/preferences`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...existing, notifications: updated }),
      })
      toast.success("Preferences saved")
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  function toggle(key: keyof NotificationPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => savePrefs(updated), 800)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
      {NOTIF_ITEMS.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{item.label}</p>
            <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
          <Toggle
            checked={prefs[item.key]}
            onChange={() => toggle(item.key)}
          />
        </div>
      ))}
      {saving && (
        <div className="flex items-center gap-1.5 px-5 py-2.5 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </div>
      )}
    </div>
  )
}

// ─── Close account modal ──────────────────────────────────────────────────────

function CloseAccountModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [step, setStep] = useState<"confirm" | "working" | "done">("confirm")
  const [typed, setTyped] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleDelete() {
    if (typed !== email) { setError("Email does not match"); return }
    setStep("working")
    try {
      const res = await fetch("/api/auth/close-account", { method: "POST" })
      const body = await res.json()
      if (res.ok && body.ok) {
        setStep("done")
        setTimeout(() => {
          void signOut({ callbackUrl: "/?reason=account_closed" })
        }, 2000)
      } else {
        setError(body.error ?? "Failed to close account. Please contact support.")
        setStep("confirm")
      }
    } catch {
      setError("Network error — please try again.")
      setStep("confirm")
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step === "confirm" ? onClose : undefined} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        {step === "done" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <CheckCircle2 className="h-7 w-7 text-gray-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Account closed</p>
              <p className="mt-1 text-sm text-gray-500">Signing you out…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Close your account</p>
                  <p className="text-xs text-gray-500 mt-0.5">This cannot be undone</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 mb-5 space-y-2">
              {[
                "Your order history will be permanently deleted",
                "Your saved addresses and payment methods will be removed",
                "Any active seller account will be deactivated",
                "You will lose access to all purchases and downloads",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400 mt-0.5" />
                  <p className="text-xs text-red-700">{item}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Type <span className="font-bold text-gray-900">{email}</span> to confirm
                </label>
                <input
                  type="email"
                  value={typed}
                  onChange={e => { setTyped(e.target.value); setError("") }}
                  placeholder={email}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-200 transition"
                />
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>
              <button
                onClick={handleDelete}
                disabled={typed !== email || step === "working"}
                className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {step === "working" && <Loader2 className="h-4 w-4 animate-spin" />}
                {step === "working" ? "Deleting account…" : "Permanently close my account"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Close Account" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showClose, setShowClose] = useState(false)
  const [activeSection, setActiveSection] = useState("profile")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login?callbackUrl=/account/settings")
  }, [status, router])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActiveSection(visible[0].target.id)
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    )
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [status])

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }
  if (status === "unauthenticated") return null

  const name = session?.user?.name ?? "—"
  const email = session?.user?.email ?? "—"
  const initials = name === "—" ? "?" : name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)

  return (
    <main className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">

        {/* Back */}
        <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Account
        </Link>

        <div className="flex gap-8">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-6 space-y-1">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 px-3">Settings</p>
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    activeSection === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  } ${item.id === "danger" ? "text-red-500 hover:bg-red-50 hover:text-red-600" : ""}`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </aside>

          {/* ── Main ── */}
          <div className="min-w-0 flex-1 space-y-10">

            {/* Page header */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
              <p className="mt-1 text-sm text-gray-500">Manage your profile, password, and preferences</p>
            </div>

            {/* ── Profile ── */}
            <Section id="profile" title="Profile" subtitle="Your personal information">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {/* Avatar strip */}
                <div className="relative h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent">
                  <div
                    className="absolute -bottom-7 left-5 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-black shadow-lg ring-4 ring-white"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent, var(--primary))) 100%)" }}
                  >
                    {initials}
                  </div>
                </div>

                <div className="mt-10 divide-y divide-gray-100">
                  {[
                    { icon: User, label: "Full Name", value: name },
                    { icon: Mail, label: "Email Address", value: email },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50">
                        <Icon className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-gray-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50/80 px-5 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Name and email are managed by your identity provider.{" "}
                    <Link href="/help" className="text-primary underline underline-offset-2 hover:no-underline">Contact support</Link>{" "}
                    to update them.
                  </p>
                </div>
              </div>
            </Section>

            {/* ── Security ── */}
            <Section id="security" title="Security" subtitle="Manage your password and login settings">
              <PasswordSection email={email} />
            </Section>

            {/* ── Notifications ── */}
            <Section
              id="notifications"
              title="Notification Preferences"
              subtitle="Control what emails and alerts you receive. Changes are saved automatically."
            >
              <NotificationsSection />
            </Section>

            {/* ── Danger zone ── */}
            <Section id="danger" title="Danger Zone" subtitle="Irreversible actions — proceed with caution">
              <div className="overflow-hidden rounded-2xl border border-red-200 bg-white">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 mt-0.5">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Close Account</p>
                      <p className="mt-1 text-xs text-gray-500 max-w-sm leading-relaxed">
                        Permanently delete your account, all your data, orders, and saved information.
                        This action is irreversible and cannot be undone.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowClose(true)}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Close Account
                  </button>
                </div>
              </div>
            </Section>

          </div>
        </div>
      </div>

      {showClose && <CloseAccountModal email={email} onClose={() => setShowClose(false)} />}
    </main>
  )
}
