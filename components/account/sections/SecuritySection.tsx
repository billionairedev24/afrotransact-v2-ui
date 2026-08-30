"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  X,
  AlertCircle,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  LogOut,
} from "lucide-react"
import { toast } from "sonner"

function passwordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  barColor: string
  textColor: string
} {
  if (pw.length === 0) return { score: 0, label: "", barColor: "bg-muted", textColor: "text-muted-foreground" }
  if (pw.length < 8)   return { score: 1, label: "Weak",   barColor: "bg-red-500",     textColor: "text-red-600" }
  const hasUpper = /[A-Z]/.test(pw)
  const hasNum   = /[0-9]/.test(pw)
  const hasSym   = /[^a-zA-Z0-9]/.test(pw)
  if (pw.length < 12) return { score: 2, label: "Fair", barColor: "bg-amber-500",  textColor: "text-amber-600" }
  if (hasUpper && hasNum && hasSym)
    return { score: 4, label: "Strong", barColor: "bg-brand-green", textColor: "text-brand-green" }
  return { score: 3, label: "Good", barColor: "bg-brand-gold", textColor: "text-brand-gold-ink" }
}

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition"

export function PasswordCard() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)
  const strength = passwordStrength(next)

  function reset() {
    setCurrent("")
    setNext("")
    setConfirm("")
    setShowCurrent(false)
    setShowNext(false)
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { toast.error("Passwords do not match"); return }
    if (next.length < 8)  { toast.error("Password must be at least 8 characters"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const body = await res.json()
      if (res.ok && body.ok) { toast.success("Password updated"); reset() }
      else { toast.error(body.error ?? "Could not update password") }
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Lock className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Password</p>
            <p className="text-xs text-muted-foreground mt-0.5">Change the password you use to sign in.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 inline-flex items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {open ? "Cancel" : "Change"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-border bg-muted/40 px-5 py-5 space-y-4">
          <div>
            <label htmlFor="acct-current-password" className="mb-1.5 block text-xs font-semibold text-foreground">Current password</label>
            <div className="relative">
              <input
                id="acct-current-password"
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter your current password"
                className={inputCls}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="acct-new-password" className="mb-1.5 block text-xs font-semibold text-foreground">New password</label>
            <div className="relative">
              <input
                id="acct-new-password"
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 8 characters"
                className={inputCls}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNext((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {next.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.barColor : "bg-muted"}`}
                    />
                  ))}
                </div>
                <p className={`text-[11px] font-semibold ${strength.textColor}`}>{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="acct-confirm-password" className="mb-1.5 block text-xs font-semibold text-foreground">Confirm new password</label>
            <div className="relative">
              <input
                id="acct-confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the new password"
                className={`${inputCls} ${
                  confirm && next && confirm !== next ? "border-red-400 focus:border-red-400 focus:ring-red-200" : ""
                }`}
                required
                autoComplete="new-password"
              />
              {confirm && next && confirm === next && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              )}
            </div>
            {confirm && next && confirm !== next && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={reset} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !current || !next || !confirm}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function CloseAccountCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Close your account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all associated data.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center rounded-xl border border-red-300 bg-background px-3.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
        >
          Close account
        </button>
      </div>
      {open && <CloseAccountModal email={email} onClose={() => setOpen(false)} />}
    </div>
  )
}

function CloseAccountModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [step, setStep] = useState<"confirm" | "working" | "done">("confirm")
  const [typed, setTyped] = useState("")
  const [error, setError] = useState("")

  async function handleDelete() {
    if (typed !== email) { setError("Email does not match"); return }
    setStep("working")
    try {
      const res = await fetch("/api/auth/close-account", { method: "POST" })
      const body = await res.json()
      if (res.ok && body.ok) {
        setStep("done")
        setTimeout(() => void signOut({ callbackUrl: "/?reason=account_closed" }), 1500)
      } else {
        setError(body.error ?? "Could not close account. Please contact support.")
        setStep("confirm")
      }
    } catch {
      setError("Network error — please try again.")
      setStep("confirm")
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={step === "confirm" ? onClose : undefined}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="text-base font-semibold text-foreground">Account closed</p>
              <p className="mt-1 text-sm text-muted-foreground">Signing you out…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Close your account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="rounded-xl border border-red-100 bg-red-50/60 p-4 mb-5 space-y-2">
              {[
                "Your order history will be permanently deleted",
                "Saved addresses and payment methods will be removed",
                "Any active seller account will be deactivated",
                "You will lose access to all past purchases",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Type <span className="font-bold">{email}</span> to confirm
              </label>
              <input
                type="email"
                value={typed}
                onChange={(e) => { setTyped(e.target.value); setError("") }}
                placeholder={email}
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 transition"
              />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={typed !== email || step === "working"}
              className="mt-4 w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {step === "working" && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === "working" ? "Closing account…" : "Permanently close my account"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Active devices ──────────────────────────────────────────────────────

interface SessionRow {
  id: string
  current: boolean
  device: { label: string; browser: string; os: string; type: string; known: boolean }
  ip: string | null
  location: string | null
  started: number | null
  lastActive: number | null
}

function relativeTime(ms: number | null): string {
  if (!ms) return ""
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "active just now"
  if (mins < 60) return `active ${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `active ${hrs} hr${hrs === 1 ? "" : "s"} ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `active ${days} day${days === 1 ? "" : "s"} ago`
  return `last active ${new Date(ms).toLocaleDateString()}`
}

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type === "mobile" ? Smartphone : type === "tablet" ? Tablet : Monitor
  return <Icon className={className} />
}

function DevicesCard() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SessionRow[]>([])
  const [lastLogin, setLastLogin] = useState<number | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/sessions", { cache: "no-store" })
      if (!res.ok) {
        setRows([])
        return
      }
      const data = await res.json()
      setRows(Array.isArray(data.sessions) ? data.sessions : [])
      setLastLogin(typeof data.lastLogin === "number" ? data.lastLogin : null)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(target: { sessionId?: string; allExceptCurrent?: boolean }, key: string) {
    setRevoking(key)
    try {
      const res = await fetch("/api/account/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      })
      if (res.ok) {
        toast.success(target.allExceptCurrent ? "Signed out of your other devices" : "Device signed out")
        await load()
      } else {
        toast.error("Could not sign out that device")
      }
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setRevoking(null)
    }
  }

  const current = rows.find((r) => r.current)
  const others = rows.filter((r) => !r.current)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Monitor className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Where you&apos;re signed in</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastLogin
                ? `Last sign-in ${relativeTime(lastLogin).replace(/^active /, "")}`
                : "Devices currently signed in to your account."}
            </p>
          </div>
        </div>
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => revoke({ allExceptCurrent: true }, "all")}
            disabled={revoking !== null}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            {revoking === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Sign out everywhere else
          </button>
        )}
      </div>

      <div className="border-t border-border">
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your devices…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            We couldn&apos;t load your active sessions right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {current && <DeviceRow key={current.id} s={current} revoking={revoking} onRevoke={revoke} />}
            {others.map((s) => (
              <DeviceRow key={s.id} s={s} revoking={revoking} onRevoke={revoke} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DeviceRow({
  s,
  revoking,
  onRevoke,
}: {
  s: SessionRow
  revoking: string | null
  onRevoke: (t: { sessionId?: string }, key: string) => void
}) {
  const locationBits = [s.location, s.location ? null : s.ip].filter(Boolean).join("")
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
          (s.current ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-foreground")
        }
      >
        <DeviceIcon type={s.device.type} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {s.device.known ? s.device.label : "Signed-in session"}
          </p>
          {s.current && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              This device
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {locationBits && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {locationBits}
            </span>
          )}
          {(s.lastActive || s.started) && <span>{relativeTime(s.lastActive ?? s.started)}</span>}
        </p>
      </div>
      {!s.current && (
        <button
          type="button"
          onClick={() => onRevoke({ sessionId: s.id }, s.id)}
          disabled={revoking !== null}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          {revoking === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Sign out
        </button>
      )}
    </li>
  )
}

/**
 * SecuritySection — active devices + password + account-close cards without the
 * page chrome. Rendered inline on the consolidated /account page.
 */
export function SecuritySection() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login?callbackUrl=/account")
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }
  if (status === "unauthenticated") return null

  const email = session?.user?.email ?? ""

  return (
    <div className="space-y-4">
      <DevicesCard />
      <PasswordCard />
      <CloseAccountCard email={email} />
    </div>
  )
}
