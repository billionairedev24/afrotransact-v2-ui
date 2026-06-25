"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useCartStore, clearGuestCart } from "@/stores/cart-store"
import { getAccessToken } from "@/lib/auth-helpers"
import { clearServerCart } from "@/lib/api"

// Session-mode polling: Stripe returns the buyer here with ?session=<uuid>
// in the URL (set by _stripe-payment.tsx return_url). The order row does NOT
// exist yet — it's materialized by the order-service when the payment.completed
// Kafka event lands. We poll /api/public/checkout-sessions/:id/result every
// POLL_INTERVAL_MS for up to POLL_TIMEOUT_MS.
const POLL_INTERVAL_MS = 1200
const POLL_TIMEOUT_MS = 30_000

type SessionResult =
  | { status: "initiated" }
  | { status: "converted"; orderId: string }
  | { status: "failed"; reason?: string }
  | { status: "abandoned" }

function CheckoutCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)
  const redirectStatus = searchParams.get("redirect_status")
  const sessionId = searchParams.get("session")
  const [pollState, setPollState] = useState<"idle" | "polling" | "timeout" | "failed">(
    sessionId ? "polling" : "idle",
  )

  const legacyStatus = redirectStatus === "failed" ? "failed" : "success"

  // Local-cart clear (legacy + session-mode success share this side-effect)
  useEffect(() => {
    if (sessionId) return // session-mode: defer until we confirm conversion
    if (redirectStatus !== "succeeded") return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (cancelled) return
        if (token) {
          await clearServerCart(token)
        }
      } catch {
        // Webhook may clear the server cart later — still clear local UI state
      }
      if (!cancelled) {
        clearCart()
        try {
          clearGuestCart()
        } catch {
          // non-fatal
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [redirectStatus, clearCart, sessionId])

  // Session-mode poll
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/public/checkout-sessions/${encodeURIComponent(sessionId)}/result`, {
          cache: "no-store",
        })
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as SessionResult
          if (data.status === "converted" && "orderId" in data && data.orderId) {
            // Clear cart now that we know the order materialized
            try {
              const token = await getAccessToken()
              if (token) await clearServerCart(token)
            } catch {
              // non-fatal
            }
            clearCart()
            try {
              clearGuestCart()
            } catch {
              // non-fatal
            }
            router.replace(`/orders/${data.orderId}`)
            return
          }
          if (data.status === "failed" || data.status === "abandoned") {
            setPollState("failed")
            return
          }
        }
      } catch {
        // network blip — keep polling until timeout
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPollState("timeout")
        return
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    let timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, router, clearCart])

  // ── Session-mode rendering ────────────────────────────────────────────
  if (sessionId) {
    if (pollState === "polling") {
      return (
        <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-foreground" />
          <h1 className="text-xl font-bold text-gray-900 mt-6">Finalizing your order…</h1>
          <p className="text-gray-500 text-sm mt-2">
            Hang tight while we confirm your payment. This usually takes a few seconds.
          </p>
        </main>
      )
    }
    return (
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
          <XCircle className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">Something went wrong</h1>
        <p className="text-gray-500 text-sm mt-2">
          We couldn&apos;t confirm your order. If your card was charged, please contact support — we&apos;ll
          sort it out.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => router.push("/cart")}
            className="rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold/90 transition-colors"
          >
            Back to cart
          </button>
          <button
            onClick={() => router.push("/help")}
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Contact support
          </button>
        </div>
      </main>
    )
  }

  // ── Legacy rendering (no session= param) ──────────────────────────────
  if (legacyStatus === "failed") {
    return (
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
          <XCircle className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">Payment Failed</h1>
        <p className="text-gray-500 text-sm mt-2">Your payment could not be processed. Please try again.</p>
        <button
          onClick={() => router.push("/checkout")}
          className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10]"
        >
          Try Again
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
      <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-green-500/15 border border-green-500/30">
        <CheckCircle className="h-10 w-10 text-green-400" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mt-6">Order Placed!</h1>
      <p className="text-gray-500 text-sm mt-2">
        Thank you for your purchase. You&apos;ll receive a confirmation email shortly.
      </p>
      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={() => router.push("/orders")}
          className="rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold/90 transition-colors"
        >
          View Orders
        </button>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    </main>
  )
}

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-foreground" />
        <p className="mt-4 text-gray-500">Loading…</p>
      </main>
    }>
      <CheckoutCompleteContent />
    </Suspense>
  )
}
