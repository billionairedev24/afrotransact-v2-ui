"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

// Reveal the first character + domain, mask the middle — e.g. "a••••@store.com".
export function maskEmail(email: string): string {
  const at = email.indexOf("@")
  if (at <= 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const first = local[0]
  const dots = "•".repeat(Math.min(Math.max(local.length - 1, 3), 6))
  return `${first}${dots}${domain}`
}

// Reveal the last 2 digits, mask the rest, keeping a leading "+".
export function maskPhone(phone: string): string {
  const trimmed = phone.trim()
  const plus = trimmed.startsWith("+") ? "+" : ""
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 2) return trimmed
  const last = digits.slice(-2)
  const dots = "•".repeat(Math.min(Math.max(digits.length - 2, 3), 9))
  return `${plus}${dots}${last}`
}

// Per-instance masked email with its own reveal toggle, so revealing one row
// never affects another. Mirrors the admin users page.
export function MaskedEmail({ email, className }: { email: string; className?: string }) {
  const [revealed, setRevealed] = useState(false)
  if (!email) return <span className={className}>—</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={className}>{revealed ? email : maskEmail(email)}</span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide email" : "Show email"}
        aria-pressed={revealed}
        className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}

// Per-instance masked phone with its own reveal toggle (mirrors MaskedEmail).
export function MaskedPhone({ phone, className }: { phone: string; className?: string }) {
  const [revealed, setRevealed] = useState(false)
  if (!phone) return <span className={className}>—</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={className}>{revealed ? phone : maskPhone(phone)}</span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide phone" : "Show phone"}
        aria-pressed={revealed}
        className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}
