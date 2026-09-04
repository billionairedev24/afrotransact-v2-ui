"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { CreditCard, Loader2, ShieldCheck } from "lucide-react"
import {
  deleteSavedPaymentMethod,
  getUserProfile,
  listSavedPaymentMethods,
  updateUserDefaults,
  type SavedPaymentMethod,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"
import { friendlyMessage } from "@/lib/errors"
import { confirmDialog } from "@/components/ui/confirm"
import { PaymentCard } from "@/components/account/PaymentCard"

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
  /** Account holder name, used as the card-holder line (Stripe doesn't return
   *  a per-card cardholder name to us; the account owner is the closest truth). */
  const [holderName, setHolderName] = useState<string | null>(null)

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
      setHolderName([profile.firstName, profile.lastName].filter(Boolean).join(" ") || null)
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
      const card = (methods ?? []).find((x) => x.id === id)
      const label = card ? `${(card.brand ?? "card")} ending in ${card.last4 ?? "••••"}` : "this card"
      if (
        !(await confirmDialog({
          title: "Remove this card?",
          description: `${label} will be removed from your account. You can add it again at checkout.`,
          confirmLabel: "Remove",
          variant: "danger",
        }))
      )
        return
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
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && methods === null ? (
        <div className="flex items-center justify-center rounded-2xl border border-input bg-card py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading saved cards…
        </div>
      ) : methods && methods.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {methods.map((m) => (
            <PaymentCard
              key={m.id}
              brand={m.brand}
              last4={m.last4}
              expMonth={m.expMonth}
              expYear={m.expYear}
              holderName={holderName}
              isDefault={m.stripePmId === defaultPmId}
              settingDefault={settingDefaultId === m.stripePmId}
              deleting={deletingId === m.id}
              onSetDefault={() => handleSetDefault(m.stripePmId)}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
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
