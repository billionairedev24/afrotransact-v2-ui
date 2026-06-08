"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { CreditCard, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import {
  deleteSavedPaymentMethod,
  listSavedPaymentMethods,
  type SavedPaymentMethod,
} from "@/lib/api"

function formatBrand(brand: string | null): string {
  if (!brand) return "Card"
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

function formatExpiry(month: number | null, year: number | null): string {
  if (!month || !year) return ""
  const mm = month.toString().padStart(2, "0")
  const yy = year.toString().slice(-2)
  return `${mm}/${yy}`
}

export default function PaymentMethodsPage() {
  const { data: session, status } = useSession()
  const token = (session as { accessToken?: string } | null)?.accessToken
  const [methods, setMethods] = useState<SavedPaymentMethod[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const list = await listSavedPaymentMethods(token)
      setMethods(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved cards.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (status === "authenticated" && token) {
      void refresh()
    }
  }, [status, token, refresh])

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return
      setDeletingId(id)
      // Optimistic remove — restore on failure.
      const prev = methods
      setMethods((m) => (m ?? []).filter((x) => x.id !== id))
      try {
        await deleteSavedPaymentMethod(token, id)
      } catch (e) {
        setMethods(prev)
        setError(e instanceof Error ? e.message : "Could not remove that card.")
      } finally {
        setDeletingId(null)
      }
    },
    [token, methods],
  )

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <CreditCard className="mx-auto h-14 w-14 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900 mt-5">Sign in to manage payment methods</h1>
        <Link
          href="/auth/login"
          className="inline-block mt-6 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
        >
          Sign In
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Payment Methods</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Cards you have saved at checkout. Tokenized by Stripe — we never store raw card numbers.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && methods === null ? (
        <div className="flex items-center justify-center rounded-2xl border border-input bg-card py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading saved cards…
        </div>
      ) : methods && methods.length > 0 ? (
        <ul className="space-y-3">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-input bg-card px-5 py-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <CreditCard className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {formatBrand(m.brand)} ending in {m.last4 ?? "••••"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatExpiry(m.expMonth, m.expYear) || "Expiry unavailable"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={deletingId === m.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {deletingId === m.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-input bg-card px-6 py-16 text-center">
          <CreditCard className="mx-auto h-14 w-14 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground mt-5">No saved cards yet</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
            Tick &ldquo;Save this card for future purchases&rdquo; at checkout to store a card here for one-click reuse next time.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Cards are tokenized and stored by Stripe.
          </div>
        </div>
      )}
    </main>
  )
}
