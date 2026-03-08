"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useCartStore } from "@/stores/cart-store"
import { Suspense } from "react"

function CheckoutCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)
  const redirectStatus = searchParams.get("redirect_status")
  const status = redirectStatus === "failed" ? "failed" : "success"

  useEffect(() => {
    if (redirectStatus !== "failed") {
      clearCart()
    }
  }, [redirectStatus, clearCart])

  if (status === "failed") {
    return (
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
          <XCircle className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mt-6">Payment Failed</h1>
        <p className="text-gray-400 text-sm mt-2">Your payment could not be processed. Please try again.</p>
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
      <h1 className="text-xl font-bold text-white mt-6">Order Placed!</h1>
      <p className="text-gray-400 text-sm mt-2">
        Thank you for your purchase. You&apos;ll receive a confirmation email shortly.
      </p>
      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={() => router.push("/orders")}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
        >
          View Orders
        </button>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors"
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
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-gray-400">Loading…</p>
      </main>
    }>
      <CheckoutCompleteContent />
    </Suspense>
  )
}
