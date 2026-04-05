"use client"

import { useState, useTransition } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  User,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react"

// --------------------------------------------------------------------------
// Toast component (inline, no external deps)
// --------------------------------------------------------------------------
type ToastType = "success" | "error"

function Toast({
  type,
  message,
  onClose,
}: {
  type: ToastType
  message: string
  onClose: () => void
}) {
  return (
    <div
      role="alert"
      className={`fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-4 shadow-2xl transition-all ${
        type === "success"
          ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-200"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <p className="flex-1 text-sm leading-relaxed font-medium">{message}</p>
      <button
        onClick={onClose}
        className="text-current/50 hover:text-current/80 transition-colors text-xs shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

// --------------------------------------------------------------------------
// Read-only info row
// --------------------------------------------------------------------------
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Password change row — calls our BFF, never touches Keycloak directly
// --------------------------------------------------------------------------
function PasswordRow() {
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null)
  const [sent, setSent] = useState(false)

  function handleChangePassword() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/change-password", { method: "POST" })
        const body = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && body.ok) {
          setSent(true)
          setToast({
            type: "success",
            message:
              "Password reset email sent! Check your inbox for a secure link to set your new password.",
          })
        } else {
          setToast({
            type: "error",
            message: body.error ?? "Unable to send reset email. Please try again.",
          })
        }
      } catch {
        setToast({ type: "error", message: "Network error. Please check your connection and try again." })
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Password</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {sent ? (
              <span className="text-emerald-500 text-xs font-semibold">
                ✓ Reset email sent — check your inbox
              </span>
            ) : (
              "••••••••••••"
            )}
          </p>
        </div>
        <button
          onClick={handleChangePassword}
          disabled={isPending || sent}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Sending…
            </>
          ) : sent ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Email sent
            </>
          ) : (
            <>
              Change
              <ChevronRight className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </>
  )
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------
export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/login?callbackUrl=/account/settings")
    return null
  }

  const name = session?.user?.name ?? "—"
  const email = session?.user?.email ?? "—"

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Account
        </Link>

        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Account Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your profile information and security preferences.
            </p>
          </div>

          {/* Section: Profile Information */}
          <section aria-labelledby="profile-heading">
            <h2
              id="profile-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Profile Information
            </h2>
            <div className="space-y-2.5">
              <InfoRow icon={User} label="Full Name" value={name} />
              <InfoRow icon={Mail} label="Email Address" value={email} />
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground/60 px-1">
              Your name and email are managed through your identity provider. Contact support to update them.
            </p>
          </section>

          {/* Section: Security */}
          <section aria-labelledby="security-heading">
            <h2
              id="security-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Security
            </h2>
            <PasswordRow />
            <p className="mt-2.5 text-xs text-muted-foreground/60 px-1">
              Clicking <strong className="font-semibold text-muted-foreground">Change</strong> will send a secure password reset link to{" "}
              <span className="font-medium text-foreground">{email}</span>. You will not be redirected anywhere — just check your email.
            </p>
          </section>

          {/* Danger zone placeholder */}
          <section aria-labelledby="danger-heading">
            <h2
              id="danger-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-widest text-red-500/70"
            >
              Danger Zone
            </h2>
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Close Account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                disabled
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3.5 py-1.5 text-xs font-semibold text-destructive opacity-50 cursor-not-allowed"
              >
                Request account deletion
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
