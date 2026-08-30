"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, User as UserIcon, Mail, Phone, CheckCircle2, CalendarDays } from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getUserProfile, updateUserProfile, type UserProfile } from "@/lib/api"

/**
 * ProfileSection — the actual form, rendered inline on the consolidated
 * /account page.
 */
export function ProfileSection() {
  const { status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
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
        setFirstName(p.firstName ?? "")
        setLastName(p.lastName ?? "")
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
      const updated = await updateUserProfile(token, {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
      })
      setProfile(updated)
      setFirstName(updated.firstName ?? "")
      setLastName(updated.lastName ?? "")
      setPhone(updated.phone ?? "")
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

  const memberSince = (() => {
    if (!profile.createdAt) return null
    const d = new Date(profile.createdAt)
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  })()

  return (
    <div className="space-y-4">
      {/* Editable identity */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
          <TextRow
            id="profile-first-name"
            icon={UserIcon}
            label="First name"
            value={firstName}
            placeholder="First name"
            autoComplete="given-name"
            onChange={(v) => { setFirstName(v); setDirty(true) }}
          />
          <TextRow
            id="profile-last-name"
            icon={UserIcon}
            label="Last name"
            value={lastName}
            placeholder="Last name"
            autoComplete="family-name"
            onChange={(v) => { setLastName(v); setDirty(true) }}
          />
        </div>
        <PhoneRow
          value={phone}
          onChange={(v) => { setPhone(v); setDirty(true) }}
        />
      </div>

      {/* Read-only account facts */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ReadRow icon={Mail} label="Email" value={profile.email} verified />
        {memberSince && <ReadRow icon={CalendarDays} label="Member since" value={memberSince} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Your email is your sign-in and can&apos;t be changed here —{" "}
          <Link href="/help" className="font-semibold underline underline-offset-2 hover:no-underline">
            contact support
          </Link>{" "}
          if you need to update it.
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

function TextRow({
  id,
  icon: Icon,
  label,
  value,
  placeholder,
  autoComplete,
  onChange,
}: {
  id: string
  icon: typeof UserIcon
  label: string
  value: string
  placeholder?: string
  autoComplete?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-4 bg-card px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        <input
          id={id}
          type="text"
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
      </div>
    </div>
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
