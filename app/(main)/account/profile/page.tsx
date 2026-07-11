"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, User as UserIcon, Mail, Phone, CheckCircle2 } from "lucide-react"
import { AccountShell } from "@/components/account/AccountShell"
import { getAccessToken } from "@/lib/auth-helpers"
import { getUserProfile, updateUserProfile, type UserProfile } from "@/lib/api"

/**
 * ProfileSection — the actual form. Exported so the consolidated
 * /account page can embed it without nesting another AccountShell.
 */
export function ProfileSection() {
  const { status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phone, setPhone] = useState("")
  const [dirty, setDirty] = useState(false)

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
        const p = await getUserProfile(token)
        if (cancelled) return
        setProfile(p)
        setPhone(p.phone ?? "")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [status])

  async function handleSave() {
    if (!dirty) return
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const updated = await updateUserProfile(token, { phone: phone.trim() || null })
      setProfile(updated)
      setDirty(false)
      toast.success("Profile updated")
    } catch {
      toast.error("Could not save your changes")
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }
  if (!profile) return null

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—"

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ReadRow icon={UserIcon} label="Full name" value={fullName} />
        <ReadRow icon={Mail} label="Email" value={profile.email} verified />
        <PhoneRow
          value={phone}
          onChange={(v) => { setPhone(v); setDirty(true) }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Name and email come from your sign-in account.{" "}
          <Link href="/help" className="font-semibold underline underline-offset-2 hover:no-underline">
            Contact support
          </Link>{" "}
          to change them.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <AccountShell
      title="Profile"
      subtitle="Your personal information on file with AfroTransact."
    >
      <ProfileSection />
    </AccountShell>
  )
}

function ReadRow({
  icon: Icon,
  label,
  value,
  verified,
}: {
  icon: typeof UserIcon
  label: string
  value: string
  verified?: boolean
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-foreground break-words">{value}</p>
      </div>
      {verified && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Verified
        </span>
      )}
    </div>
  )
}

function PhoneRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Phone className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor="profile-phone" className="text-xs uppercase tracking-wide text-muted-foreground">
          Phone number
        </label>
        <input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+1 555 123 4567"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
      </div>
    </div>
  )
}
