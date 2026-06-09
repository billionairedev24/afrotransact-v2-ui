"use client"

import { useCallback, useState } from "react"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  AlertCircle,
  Lock,
  ShieldCheck,
  CreditCard,
  Plus,
} from "lucide-react"
import type { RegionPaymentMethod, SavedPaymentMethod } from "@/lib/api"

// loadStripe is only called after this module loads. Because the whole file is
// dynamic-imported from the checkout page, Stripe.js (and @stripe/react-stripe-js
// + @stripe/stripe-js) never ship in the initial checkout bundle — they land
// only when the buyer actually reaches the payment step.
let stripePromise: Promise<Stripe | null> | null = null
function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder",
    )
  }
  return stripePromise
}

const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#F5C518",
    colorBackground: "#FFFFFF",
    colorText: "#171717",
    colorDanger: "#DC2626",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
  },
  rules: {
    ".Input": { border: "1px solid #E5E5E5", padding: "10px 14px" },
    ".Input:focus": {
      border: "1px solid rgba(212,168,83,0.6)",
      boxShadow: "none",
    },
    ".Label": {
      color: "rgba(255,255,255,0.5)",
      fontSize: "12px",
      marginBottom: "4px",
    },
  },
}

function formatCents(v: number) {
  return `$${(v / 100).toFixed(2)}`
}

function StripePaymentForm({
  onBack,
  onComplete,
  totalCents,
  clientSecret,
  stripeAvailable,
  paymentMethods,
  saveCard,
  onSaveCardChange,
  savedCards,
  selectedSavedCardId,
  onSelectedSavedCardChange,
}: {
  onBack: () => void
  onComplete: () => void
  totalCents: number
  clientSecret: string | null
  stripeAvailable: boolean
  paymentMethods: RegionPaymentMethod[]
  saveCard: boolean
  onSaveCardChange: (next: boolean) => void
  savedCards: SavedPaymentMethod[]
  selectedSavedCardId: string | null
  onSelectedSavedCardChange: (id: string | null) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const usingSaved = selectedSavedCardId !== null

  const handlePay = useCallback(async () => {
    if (!stripe) return
    setError(null)
    setProcessing(true)

    if (!clientSecret) {
      setError(
        "Payment could not be initialized. Please try again or contact support.",
      )
      setProcessing(false)
      return
    }

    if (usingSaved && selectedSavedCardId) {
      // Pay with the buyer's saved PaymentMethod — no new card collection.
      const { error: confirmError } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: selectedSavedCardId },
      )
      if (confirmError) {
        setError(confirmError.message ?? "Payment failed. Please try again.")
        setProcessing(false)
      } else {
        setProcessing(false)
        onComplete()
      }
      return
    }

    if (!elements) return

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? "Payment validation failed.")
      setProcessing(false)
      return
    }

    // Note: `setup_future_usage` is set on the PaymentIntent server-side when
    // saveCard is true (see Backlog #40), so we don't need to repeat it here.
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete`,
      },
      redirect: "if_required",
    })

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.")
      setProcessing(false)
    } else {
      setProcessing(false)
      onComplete()
    }
  }, [stripe, elements, clientSecret, onComplete, usingSaved, selectedSavedCardId])

  return (
    <div className="space-y-5">
      {stripeAvailable ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="text-emerald-400 font-semibold">
                Card data never touches our servers.
              </span>{" "}
              Payment details are encrypted and sent directly to Stripe via a
              secure iframe.
            </p>
          </div>

          {savedCards.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Pay with a saved card
              </p>
              {savedCards.map((card) => {
                const checked = selectedSavedCardId === card.stripePmId
                return (
                  <label
                    key={card.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      checked
                        ? "border-brand-gold bg-brand-gold/10"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-card"
                      checked={checked}
                      onChange={() => onSelectedSavedCardChange(card.stripePmId)}
                      disabled={processing}
                      className="h-4 w-4 accent-brand-gold"
                    />
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {card.brand ?? "card"}
                    </span>
                    <span className="text-sm text-gray-600 font-mono">
                      •••• {card.last4 ?? "????"}
                    </span>
                    {card.expMonth && card.expYear && (
                      <span className="ml-auto text-xs text-gray-500 tabular-nums">
                        {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                      </span>
                    )}
                    {card.isDefault && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Default
                      </span>
                    )}
                  </label>
                )
              })}
              <label
                className={`flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 cursor-pointer transition-colors ${
                  selectedSavedCardId === null
                    ? "border-brand-gold bg-brand-gold/5"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="saved-card"
                  checked={selectedSavedCardId === null}
                  onChange={() => onSelectedSavedCardChange(null)}
                  disabled={processing}
                  className="h-4 w-4 accent-brand-gold"
                />
                <Plus className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">Use a different card</span>
              </label>
            </div>
          )}

          {!usingSaved && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-3.5 w-3.5 text-foreground" />
                <span className="text-xs text-gray-500 font-medium">
                  Secured by Stripe
                </span>
              </div>
              <PaymentElement
                options={{
                  layout: "tabs",
                  wallets: { applePay: "auto", googlePay: "auto" },
                }}
              />

              <label className="mt-4 flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={saveCard}
                  onChange={(e) => onSaveCardChange(e.target.checked)}
                  disabled={processing}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
                />
                <span className="text-sm text-foreground group-hover:text-brand-gold-hover transition-colors">
                  Remember this card for next time
                </span>
              </label>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3 rounded-2xl border border-yellow-500/30 bg-yellow-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">
              Card payments via Stripe are not available in this region.
            </p>
          </div>
          {paymentMethods.length > 0 ? (
            <div className="text-xs text-gray-700 space-y-1">
              <p className="font-semibold text-gray-800">
                Configured payment providers for this region:
              </p>
              <ul className="list-disc list-inside">
                {paymentMethods
                  .filter((m) => m.enabled)
                  .map((m) => (
                    <li key={m.id} className="capitalize">
                      {m.provider}
                    </li>
                  ))}
              </ul>
              <p className="text-yellow-700/80">
                Web checkout for these methods is not yet wired up. Please
                contact support or try again later.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-700">
              No payment methods are configured for this region yet. Please
              contact support or try again later.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex justify-between text-sm">
        <span className="text-gray-600 font-medium">Total to be charged</span>
        <span className="text-gray-900 font-bold">
          {formatCents(totalCents)}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={processing}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={handlePay}
          disabled={processing || !stripe || !stripeAvailable}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-brand-gold-foreground/30 border-t-brand-gold-foreground rounded-full animate-spin" />
              Processing…
            </span>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" /> Pay {formatCents(totalCents)}
            </>
          )}
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-600">
        By completing payment you agree to our{" "}
        <a href="/terms" className="underline hover:text-gray-500">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-gray-500">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}

export default function PaymentStep({
  onBackAction,
  onCompleteAction,
  total,
  clientSecret,
  stripeAvailable,
  paymentMethods,
  saveCard,
  onSaveCardChangeAction,
  savedCards,
  selectedSavedCardId,
  onSelectedSavedCardChangeAction,
}: {
  onBackAction: () => void
  onCompleteAction: () => void
  total: number
  clientSecret: string | null
  stripeAvailable: boolean
  paymentMethods: RegionPaymentMethod[]
  saveCard: boolean
  onSaveCardChangeAction: (next: boolean) => void
  savedCards: SavedPaymentMethod[]
  selectedSavedCardId: string | null
  onSelectedSavedCardChangeAction: (id: string | null) => void
}) {
  return (
    // `key` forces a full remount when the PaymentIntent changes (e.g. after
    // a save-card toggle re-mints the PI). Without this, Stripe Elements
    // caches the first init it saw and stripe.confirmPayment then targets a
    // PaymentIntent id that no longer exists on Stripe's side, throwing
    // "No such payment_intent: pi_…" on Pay. Falls back to "no-pi" when the
    // user hasn't yet placed the order so the step still renders.
    // The Elements `setup_future_usage` option MUST match what the backend
    // sets on the PaymentIntent. Backend sets `off_session` whenever
    // `saveCard` is true, so we mirror that here — otherwise Stripe throws
    // "The provided setup_future_usage does not match the expected
    // setup_future_usage" on confirm. Also include saveCard in the key so a
    // mid-flow toggle (without re-minting the PI) recreates Elements with
    // the new value.
    <Elements
      key={`${clientSecret ?? "no-pi"}|${saveCard ? "sfu" : "no-sfu"}`}
      stripe={getStripe()}
      options={{
        mode: "payment",
        amount: Math.max(total, 50),
        currency: "usd",
        appearance: STRIPE_APPEARANCE,
        paymentMethodCreation: "manual",
        ...(saveCard ? { setupFutureUsage: "off_session" as const } : {}),
      }}
    >
      <StripePaymentForm
        onBack={onBackAction}
        onComplete={onCompleteAction}
        totalCents={total}
        clientSecret={clientSecret}
        stripeAvailable={stripeAvailable}
        paymentMethods={paymentMethods}
        saveCard={saveCard}
        onSaveCardChange={onSaveCardChangeAction}
        savedCards={savedCards}
        selectedSavedCardId={selectedSavedCardId}
        onSelectedSavedCardChange={onSelectedSavedCardChangeAction}
      />
    </Elements>
  )
}
