"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { CreditCard, Loader2, ShieldCheck, Star, Trash2 } from "lucide-react"
import {
  deleteSavedPaymentMethod,
  getUserProfile,
  listSavedPaymentMethods,
  updateUserDefaults,
  type SavedPaymentMethod,
} from "@/lib/api"
import { AccountShell } from "@/components/account/AccountShell"
import { getAccessToken } from "@/lib/auth-helpers"
import { friendlyMessage } from "@/lib/errors"

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

export function PaymentsSection() {
  const { status } = useSession()
  const [methods, setMethods] = useState<SavedPaymentMethod[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  /** Profile-level default (Stripe PM id). Source of truth for the "Default"
   *  badge — the per-row SavedPaymentMethod.isDefault flag is the Stripe
   *  customer default, which is set separately and we don't write to. */
  const [defaultPmId, setDefaultPmId] = useState<string | null>(null)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [list, profile] = await Promise.all([
        listSavedPaymentMethods(token),
        getUserProfile(token),
      ])
      setMethods(list)
      setDefaultPmId(profile.defaultPaymentMethodId ?? null)
    } catch (e) {
      setError(friendlyMessage(e, "Failed to load saved cards."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      void refresh()
    }
  }, [status, refresh])

  const handleSetDefault = useCallback(
    async (pmId: string) => {
      const token = await getAccessToken()
      if (!token) return
      setSettingDefaultId(pmId)
      const prev = defaultPmId
      setDefaultPmId(pmId) // optimistic
      try {
        await updateUserDefaults(token, { defaultPaymentMethodId: pmId })
      } catch (e) {
        setDefaultPmId(prev)
        setError(friendlyMessage(e, "Could not set default card."))
      } finally {
        setSettingDefaultId(null)
      }
    },
    [defaultPmId],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const token = await getAccessToken()
      if (!token) return
      setDeletingId(id)
      // Optimistic remove — restore on failure.
      const prev = methods
      // Resolve the Stripe PM id so we can clear the profile default if the
      // buyer is deleting their default card.
      const removed = (methods ?? []).find((x) => x.id === id)
      setMethods((m) => (m ?? []).filter((x) => x.id !== id))
      try {
        await deleteSavedPaymentMethod(token, id)
        if (removed && removed.stripePmId === defaultPmId) {
          setDefaultPmId(null)
          await updateUserDefaults(token, { defaultPaymentMethodId: "" }).catch(() => {})
        }
      } catch (e) {
        setMethods(prev)
        setError(friendlyMessage(e, "Could not remove that card."))
      } finally {
        setDeletingId(null)
      }
    },
    [methods, defaultPmId],
  )

  if (status !== "authenticated") {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-foreground font-semibold">Sign in to manage payment methods</p>
        <Link
          href="/auth/login?callbackUrl=/account"
          className="inline-block mt-5 rounded-xl bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <>
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {formatBrand(m.brand)} ending in {m.last4 ?? "••••"}
                    </p>
                    {m.stripePmId === defaultPmId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-semibold text-brand-gold-foreground">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatExpiry(m.expMonth, m.expYear) || "Expiry unavailable"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.stripePmId !== defaultPmId && (
                  <button
                    onClick={() => handleSetDefault(m.stripePmId)}
                    disabled={settingDefaultId === m.stripePmId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="Use this card for 1-click reorder"
                  >
                    {settingDefaultId === m.stripePmId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Star className="h-3.5 w-3.5" />
                    )}
                    Set default
                  </button>
                )}
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
              </div>
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
    </>
  )
}

export default function PaymentMethodsPage() {
  return (
    <AccountShell
      title="Payment Methods"
      subtitle="Cards you have saved at checkout. Tokenized by Stripe — we never store raw card numbers."
    >
      <PaymentsSection />
    </AccountShell>
  )
}
