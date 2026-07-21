"use client"

import { useId, useState } from "react"
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Minimal, forgiving email check — the backend is the source of truth. */
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

interface EmailCaptureFormProps {
  promoId: string
  /** Copy shown above the field. */
  headline?: string
  /** Submit button label. */
  ctaLabel?: string
  /**
   * "modal"  — stacked, centered, for the popup.
   * "hero"   — horizontal on desktop, overlaid on imagery.
   */
  variant?: "modal" | "hero"
  className?: string
}

/**
 * Shared email-capture → coupon form. Posts to the promotions subscribe proxy
 * which issues a unique single-use coupon emailed to the visitor. Used by both
 * the popup modal and the hero overlay.
 */
export function EmailCaptureForm({
  promoId,
  headline,
  ctaLabel,
  variant = "modal",
  className,
}: EmailCaptureFormProps) {
  const inputId = useId()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle")
  const [error, setError] = useState<string | null>(null)

  const heading = headline || "Enter your email for an exclusive code"
  const buttonLabel = ctaLabel || "Get my code"
  const hero = variant === "hero"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.")
      return
    }
    setStatus("loading")
    try {
      const res = await fetch(`/api/public/promotions/${promoId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        status?: string
        error?: string
        message?: string
      }
      if (res.ok && data.status === "sent") {
        setStatus("success")
        return
      }
      setStatus("idle")
      if (res.status === 503) {
        setError("Something went wrong on our end. Please try again in a moment.")
      } else {
        setError(data.error || data.message || "That didn't work. Please check your email and try again.")
      }
    } catch {
      setStatus("idle")
      setError("Network error. Please try again.")
    }
  }

  if (status === "success") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
          hero
            ? "bg-white/90 text-gray-900 backdrop-blur"
            : "bg-emerald-50 text-emerald-700 justify-center",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        Check your inbox 📬 — your code is on the way
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)} noValidate>
      {heading ? (
        <label
          htmlFor={inputId}
          className={cn(
            "block text-sm font-semibold mb-2",
            hero ? "text-white drop-shadow" : "text-gray-700",
          )}
        >
          {heading}
        </label>
      ) : null}
      <div className={cn("flex gap-2", hero ? "flex-col sm:flex-row" : "flex-col")}>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(null)
          }}
          placeholder="you@example.com"
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          disabled={status === "loading"}
          className={cn(
            "min-w-0 flex-1 rounded-full border px-4 py-2.5 text-sm outline-none transition-colors disabled:opacity-60",
            hero
              ? "border-white/30 bg-white/95 text-gray-900 placeholder:text-gray-500 focus:border-white"
              : "border-input bg-white text-gray-900 focus:border-primary/60",
          )}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-colors disabled:opacity-60",
            "bg-[#F5C518] text-gray-900 hover:bg-[#E5B100]",
          )}
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {buttonLabel}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className={cn(
            "mt-2 text-xs font-medium",
            hero ? "text-white drop-shadow" : "text-red-600",
          )}
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}
