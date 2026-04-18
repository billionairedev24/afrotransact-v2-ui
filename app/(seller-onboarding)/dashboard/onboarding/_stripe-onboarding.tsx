"use client"

import { useState } from "react"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { AlertCircle, Loader2, Shield } from "lucide-react"

// Stripe.js loads only when this module loads, and this module is itself
// dynamic-imported from the onboarding page — so the ~80KB Stripe bundle stays
// out of the onboarding's initial payload until the seller reaches the payment
// method step.
let stripePromise: Promise<Stripe | null> | null = null
function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder",
    )
  }
  return stripePromise
}

function StripeCardForm({
  onConfirm,
  saving,
}: {
  onConfirm: (pmId: string) => void
  saving: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setConfirming(true)
    setError(null)

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    })

    if (result.error) {
      setError(result.error.message ?? "Card setup failed")
      setConfirming(false)
      return
    }

    if (result.setupIntent?.payment_method) {
      const pmId =
        typeof result.setupIntent.payment_method === "string"
          ? result.setupIntent.payment_method
          : result.setupIntent.payment_method.id
      onConfirm(pmId)
    }
    setConfirming(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs text-gray-500 mb-4">
          Secure card collection powered by Stripe
        </p>
        <PaymentElement options={{ layout: "tabs" }} />
        {error && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={!stripe || saving || confirming}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {confirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving Card…
            </>
          ) : (
            <>Save Payment Method</>
          )}
        </button>
        <p className="text-[10px] text-gray-600 mt-3 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Card data is processed by Stripe and never touches our servers. PCI DSS
          compliant.
        </p>
      </div>
    </form>
  )
}

export default function PaymentMethodForm({
  setupIntentSecret,
  onConfirm,
  saving,
}: {
  setupIntentSecret: string | null
  onConfirm: (pmId: string) => void
  saving: boolean
}) {
  if (!setupIntentSecret) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <p className="text-sm text-yellow-400">
            Click &quot;Connect Stripe Account&quot; above first. A secure card
            form will appear here once your account is ready.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret: setupIntentSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#f97316",
            colorBackground: "#f9fafb",
            colorText: "#111827",
            colorDanger: "#ef4444",
            borderRadius: "12px",
            fontFamily: "inherit",
          },
          rules: {
            ".Input": {
              border: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
            },
            ".Input:focus": {
              border: "1px solid rgba(249,115,22,0.5)",
              boxShadow: "0 0 0 1px rgba(249,115,22,0.3)",
            },
            ".Label": {
              color: "#6b7280",
              fontSize: "13px",
              fontWeight: "500",
            },
          },
        },
      }}
    >
      <StripeCardForm onConfirm={onConfirm} saving={saving} />
    </Elements>
  )
}
