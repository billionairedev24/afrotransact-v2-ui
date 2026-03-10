"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  CheckCircle,
  ChevronRight,
  CreditCard,
  MapPin,
  Package,
  Lock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Ticket,
} from "lucide-react"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { useCartStore } from "@/stores/cart-store"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  checkout as apiCheckout,
  mergeCart,
  getRegions,
  getAddresses,
  createAddress,
  getUserProfile,
  validateCoupon,
  ApiError,
  type CheckoutResponse,
  type Region,
  type UserAddress,
} from "@/lib/api"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder"
)

const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#d4a853",
    colorBackground: "#1c1c1e",
    colorText: "#ffffff",
    colorDanger: "#f87171",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
  },
  rules: {
    ".Input": { border: "1px solid rgba(255,255,255,0.12)", padding: "10px 14px" },
    ".Input:focus": { border: "1px solid rgba(212,168,83,0.6)", boxShadow: "none" },
    ".Label": { color: "rgba(255,255,255,0.5)", fontSize: "12px", marginBottom: "4px" },
  },
}

type Step = "address" | "review" | "payment"

const STEPS: { id: Step; label: string; icon: typeof MapPin }[] = [
  { id: "address", label: "Shipping",  icon: MapPin     },
  { id: "review",  label: "Review",    icon: Package    },
  { id: "payment", label: "Payment",   icon: CreditCard },
]

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function AddressStep({ onNext, token }: { onNext: (addr: Record<string, string>) => void; token: string | null }) {
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [makeDefault, setMakeDefault] = useState(false)
  const [form, setForm] = useState({
    fullName: "", line1: "", line2: "", city: "", state: "", zip: "", phone: "",
  })
  const [addressQuery, setAddressQuery] = useState("")

  useEffect(() => {
    if (!token) { setLoading(false); setShowNew(true); return }
    Promise.all([getUserProfile(token), getAddresses(token)])
      .then(([profile, addrs]) => {
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ")
        setForm((prev) => ({
          ...prev,
          fullName: name || prev.fullName,
          phone: profile.phone || prev.phone,
        }))
        setSavedAddresses(addrs)
        const def = addrs.find((a) => a.isDefault)
        if (def) setSelectedId(def.id)
        else if (addrs.length > 0) setSelectedId(addrs[0].id)
        else setShowNew(true)
      })
      .catch(() => setShowNew(true))
      .finally(() => setLoading(false))
  }, [token])

  const handleUseSaved = () => {
    const addr = savedAddresses.find((a) => a.id === selectedId)
    if (!addr) return
    onNext({
      shippingAddressId: addr.id,
      fullName: form.fullName,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      state: addr.state || "",
      zip: addr.postalCode || "",
      phone: form.phone || "",
    })
  }

  const handleSaveNew = async () => {
    if (!token || !form.line1 || !form.city || !form.zip) return
    setSaving(true)
    try {
      const created = await createAddress(token, {
        label: "shipping",
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        state: form.state,
        postalCode: form.zip,
        countryCode: "US",
        isDefault: makeDefault || savedAddresses.length === 0,
      })
      onNext({
        shippingAddressId: created.id,
        fullName: form.fullName,
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone,
      })
    } catch {
      onNext(form)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
      />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Shipping Address</h2>

      {savedAddresses.length > 0 && !showNew && (
        <>
          <div className="space-y-2">
            {savedAddresses.map((addr) => (
              <button
                key={addr.id}
                onClick={() => setSelectedId(addr.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedId === addr.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{addr.label || "Address"}</span>
                  {addr.isDefault && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                <p className="text-sm text-gray-400">{addr.city}, {addr.state} {addr.postalCode}</p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 p-4 space-y-3" style={{ background: "hsl(0 0% 11%)" }}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Shipping Contact</p>
            <div className="grid grid-cols-2 gap-3">
              {field("Full name", "fullName", "Jane Doe")}
              {field("Phone", "phone", "(512) 555-0123")}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowNew(true)}
              className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              + New Address
            </button>
            <button
              disabled={!selectedId || !form.fullName}
              onClick={handleUseSaved}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {(showNew || savedAddresses.length === 0) && (
        <>
          {savedAddresses.length > 0 && (
            <button
              onClick={() => setShowNew(false)}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              &larr; Use saved address
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {field("Full name", "fullName", "Jane Doe")}
            {field("Phone", "phone", "(512) 555-0123")}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Address</label>
            <AddressAutocomplete
              value={addressQuery}
              onChange={setAddressQuery}
              onSelect={(parts) => {
                setForm((prev) => ({
                  ...prev,
                  line1: parts.line1,
                  line2: parts.line2 || prev.line2,
                  city: parts.city || prev.city,
                  state: parts.state || prev.state,
                  zip: parts.zip || prev.zip,
                }))
                setAddressQuery(parts.line1)
              }}
              placeholder="Start typing your address…"
            />
          </div>
          {field("Apt, suite, unit (optional)", "line2", "Apt 4B")}
          <div className="grid grid-cols-2 gap-3">
            {field("City", "city")}
            {field("State", "state")}
          </div>
          {field("ZIP code", "zip", "78701")}

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary accent-primary"
            />
            <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
              Set as my default address
            </span>
          </label>

          <button
            disabled={!form.fullName || !form.line1 || !form.city || !form.zip || saving}
            onClick={handleSaveNew}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue to Review <ChevronRight className="h-4 w-4" /></>}
          </button>
        </>
      )}
    </div>
  )
}

function ReviewStep({
  address, onNext, onBack, items, subtotal, discount, tax, shipping, total, placing, error: placeError,
  couponCode, couponApplied, couponError, couponValidating, onCouponChange, onApplyCoupon, onRemoveCoupon,
}: {
  address: Record<string, string>
  onNext: () => void
  onBack: () => void
  items: { variantId: string; title: string; price: number; quantity: number; imageUrl?: string }[]
  subtotal: number; discount: number; tax: number; shipping: number; total: number
  placing: boolean; error: string | null
  couponCode: string; couponApplied: boolean; couponError: string | null; couponValidating: boolean
  onCouponChange: (v: string) => void; onApplyCoupon: () => void; onRemoveCoupon: () => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Review Your Order</h2>

      <div className="rounded-2xl border border-white/10 p-4 space-y-1" style={{ background: "hsl(0 0% 13%)" }}>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-white">Shipping to</span>
        </div>
        <p className="text-sm text-gray-300">{address.fullName}</p>
        <p className="text-sm text-gray-300">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
        <p className="text-sm text-gray-300">{address.city}, {address.state} {address.zip}</p>
      </div>

      <div className="rounded-2xl border border-white/10 p-4 space-y-2" style={{ background: "hsl(0 0% 13%)" }}>
        <p className="text-sm font-semibold text-white mb-3">Items</p>
        {items.map((item) => (
          <div key={item.variantId} className="flex justify-between text-sm">
            <span className="text-gray-300 truncate max-w-[220px]">{item.title} x {item.quantity}</span>
            <span className="text-white font-medium shrink-0 ml-2">{formatCents(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Coupon input */}
      <div className="rounded-2xl border border-white/10 p-4" style={{ background: "hsl(0 0% 13%)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-white">Have a coupon?</span>
        </div>
        {couponApplied ? (
          <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5">
            <div>
              <span className="text-sm font-mono font-medium text-green-400">{couponCode.toUpperCase()}</span>
              <span className="text-sm text-green-400 ml-2">−{formatCents(discount)}</span>
            </div>
            <button onClick={onRemoveCoupon} className="text-xs text-gray-400 hover:text-white transition-colors">Remove</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => onCouponChange(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={onApplyCoupon}
              disabled={couponValidating || !couponCode.trim()}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-40 transition-colors"
            >
              {couponValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </button>
          </div>
        )}
        {couponError && <p className="text-xs text-red-400 mt-2">{couponError}</p>}
      </div>

      <div className="rounded-2xl border border-white/10 p-4 space-y-2" style={{ background: "hsl(0 0% 13%)" }}>
        <div className="flex justify-between text-sm text-gray-300">
          <span>Subtotal</span><span>{formatCents(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span>Discount</span><span>−{formatCents(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-300">
          <span>Shipping</span><span className="text-green-400">{shipping === 0 ? "Free" : formatCents(shipping)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-300">
          <span>Tax</span><span>{formatCents(tax)}</span>
        </div>
        <div className="my-2 border-t border-white/10" />
        <div className="flex justify-between text-white font-bold">
          <span>Total</span><span>{formatCents(total)}</span>
        </div>
      </div>

      {placeError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{placeError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={placing} className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40">
          Back
        </button>
        <button onClick={onNext} disabled={placing} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-70">
          {placing ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Placing order…</span>
          ) : (
            <>Continue to Payment <ChevronRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  )
}

function StripePaymentForm({
  onBack, onComplete, totalCents, clientSecret,
}: {
  onBack: () => void; onComplete: () => void; totalCents: number; clientSecret: string | null
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const [error, setError]         = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return
    setError(null)
    setProcessing(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? "Payment validation failed.")
      setProcessing(false)
      return
    }

    if (!clientSecret) {
      setError("Payment could not be initialized. Please try again or contact support.")
      setProcessing(false)
      return
    }

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
  }, [stripe, elements, clientSecret, onComplete])

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Payment</h2>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-300 leading-relaxed">
          <span className="text-emerald-400 font-semibold">Card data never touches our servers.</span>{" "}
          Payment details are encrypted and sent directly to Stripe via a secure iframe.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 p-5" style={{ background: "hsl(0 0% 13%)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-gray-400 font-medium">Secured by Stripe</span>
        </div>
        <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex justify-between text-sm">
        <span className="text-gray-300 font-medium">Total to be charged</span>
        <span className="text-white font-bold">{formatCents(totalCents)}</span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={processing} className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40">Back</button>
        <button onClick={handlePay} disabled={processing || !stripe} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-70">
          {processing ? (
            <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-[#0f0f10]/30 border-t-[#0f0f10] rounded-full animate-spin" /> Processing…</span>
          ) : (
            <><Lock className="h-3.5 w-3.5" /> Pay {formatCents(totalCents)}</>
          )}
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-600">
        By completing payment you agree to our{" "}
        <a href="/terms" className="underline hover:text-gray-400">Terms of Service</a> and{" "}
        <a href="/privacy" className="underline hover:text-gray-400">Privacy Policy</a>.
      </p>
    </div>
  )
}

function PaymentStep({
  onBack, onComplete, total, clientSecret,
}: {
  onBack: () => void; onComplete: () => void; total: number; clientSecret: string | null
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: Math.max(total, 50),
        currency: "usd",
        appearance: STRIPE_APPEARANCE,
        paymentMethodCreation: "manual",
      }}
    >
      <StripePaymentForm onBack={onBack} onComplete={onComplete} totalCents={total} clientSecret={clientSecret} />
    </Elements>
  )
}

function SuccessStep({ orderNumber }: { orderNumber: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center text-center gap-5 py-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30">
        <CheckCircle className="h-10 w-10 text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">Order placed!</h2>
        <p className="text-gray-400 text-sm mt-1">Order #{orderNumber}</p>
        <p className="text-gray-400 text-sm mt-1">You&apos;ll receive a confirmation email shortly.</p>
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={() => router.push("/orders")} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors">
          View Orders
        </button>
        <button onClick={() => router.push("/")} className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors">
          Continue Shopping
        </button>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const session = useSession()
  const status = session?.status
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step | "success">("address")
  const [address, setAddress] = useState<Record<string, string>>({})
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null)
  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponValidating, setCouponValidating] = useState(false)
  const [couponApplied, setCouponApplied] = useState(false)

  const cartItems = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const clearCart = useCartStore((s) => s.clearCart)

  const [region, setRegion] = useState<Region | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  const subtotal = getSubtotal()
  const taxRate = region?.taxRate ?? 0.0825
  const shippingFlat = region?.shippingRateCentsPerLb ?? 599
  const freeShippingThreshold = region?.freeShippingThresholdCents ?? 7500
  const tax = Math.round(subtotal * taxRate)
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingFlat
  const total = Math.max(0, subtotal - couponDiscount + tax + shipping)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (cartItems.length === 0 && step !== "success") {
      router.replace("/cart")
    }
  }, [mounted, cartItems.length, step, router])

  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    async function fetchRegion() {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        setAuthToken(token)
        const regions = await getRegions(token, true)
        if (cancelled) return
        const r = regions.find((r: Region) => r.code === "us-tx-austin") ?? regions[0]
        if (r) setRegion(r)
      } catch {
        // fall back to hardcoded defaults
      }
    }
    fetchRegion()
    return () => { cancelled = true }
  }, [mounted])

  async function syncCartAndCheckout() {
    setPlacing(true)
    setPlaceError(null)

    try {
      const token = await getAccessToken()
      if (!token) {
        router.push("/auth/login?callbackUrl=/checkout")
        return
      }

      const items = cartItems.map((item) => ({
        variantId: item.variantId,
        productId: item.productId || item.variantId,
        storeId: item.storeId,
        quantity: item.quantity,
        unitPriceCents: item.price,
        productTitle: item.title,
        variantName: item.variantName,
        imageUrl: item.imageUrl,
      }))

      await mergeCart(token, items)

      if (!region) {
        setPlaceError("Unable to load region configuration. Please refresh and try again.")
        setPlacing(false)
        return
      }

      const result = await apiCheckout(token, {
        regionId: region.id,
        shippingAddressId: address.shippingAddressId || undefined,
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 || undefined,
        city: address.city,
        state: address.state,
        zip: address.zip,
        phone: address.phone || undefined,
        couponCode: couponApplied ? couponCode.trim() : undefined,
      })

      setCheckoutResult(result)
      setStep("payment")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/auth/login?callbackUrl=/checkout")
        return
      }
      setPlaceError(e instanceof ApiError ? e.body : e instanceof Error ? e.message : "Checkout failed. Please try again.")
    } finally {
      setPlacing(false)
    }
  }

  const handlePaymentComplete = useCallback(() => {
    clearCart()
    setStep("success")
  }, [clearCart])

  const currentIdx = STEPS.findIndex((s) => s.id === step)

  if (!mounted) {
    return (
      <main className="mx-auto max-w-[680px] px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>
        <div className="rounded-2xl border border-white/10 p-6" style={{ background: "hsl(0 0% 11%)" }}>
          <div className="h-32 flex items-center justify-center text-gray-500">Loading…</div>
        </div>
      </main>
    )
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-[680px] px-4 sm:px-6 py-16 text-center">
        <Lock className="mx-auto h-12 w-12 text-gray-500" />
        <h1 className="text-xl font-bold text-white mt-4">Sign in to checkout</h1>
        <p className="text-gray-400 text-sm mt-2">Your cart items will be preserved.</p>
        <button
          onClick={() => router.push("/auth/login?callbackUrl=/checkout")}
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10]"
        >
          Sign In
        </button>
      </main>
    )
  }

  const displayTotal = checkoutResult?.totalCents ?? total

  return (
    <main className="mx-auto max-w-[680px] px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>

      {step !== "success" && (
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => {
            const done   = currentIdx > i
            const active = s.id === step
            const Icon   = s.icon
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${done ? "bg-green-500" : active ? "bg-primary" : "bg-white/10"}`}>
                    {done ? <CheckCircle className="h-5 w-5 text-white" /> : <Icon className={`h-4 w-4 ${active ? "text-[#0f0f10]" : "text-gray-500"}`} />}
                  </div>
                  <span className={`text-[11px] font-medium ${active ? "text-white" : done ? "text-green-400" : "text-gray-500"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${currentIdx > i ? "bg-green-500" : "bg-white/10"}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 p-6" style={{ background: "hsl(0 0% 11%)" }}>
        {step === "address" && (
          <AddressStep token={authToken} onNext={(addr) => { setAddress(addr); setStep("review") }} />
        )}
        {step === "review" && (
          <ReviewStep
            address={address}
            onNext={syncCartAndCheckout}
            onBack={() => setStep("address")}
            items={cartItems}
            subtotal={checkoutResult?.subtotalCents ?? subtotal}
            discount={checkoutResult?.discountCents ?? couponDiscount}
            tax={checkoutResult?.taxCents ?? tax}
            shipping={checkoutResult?.shippingCostCents ?? shipping}
            total={displayTotal}
            placing={placing}
            error={placeError}
            couponCode={couponCode}
            couponApplied={couponApplied}
            couponError={couponError}
            couponValidating={couponValidating}
            onCouponChange={(v) => { setCouponCode(v); setCouponApplied(false); setCouponDiscount(0); setCouponError(null) }}
            onApplyCoupon={async () => {
              if (!couponCode.trim()) return
              setCouponValidating(true)
              setCouponError(null)
              try {
                const token = await getAccessToken()
                if (!token) return
                const res = await validateCoupon(token, couponCode.trim(), subtotal, region?.id)
                if (res.valid) {
                  setCouponDiscount(res.discountCents)
                  setCouponApplied(true)
                } else {
                  setCouponError(res.error || "Invalid coupon")
                }
              } catch (e) {
                setCouponError(e instanceof Error ? e.message : "Failed to validate coupon")
              } finally {
                setCouponValidating(false)
              }
            }}
            onRemoveCoupon={() => { setCouponCode(""); setCouponApplied(false); setCouponDiscount(0); setCouponError(null) }}
          />
        )}
        {step === "payment" && (
          <PaymentStep
            onBack={() => setStep("review")}
            onComplete={handlePaymentComplete}
            total={displayTotal}
            clientSecret={checkoutResult?.paymentClientSecret ?? null}
          />
        )}
        {step === "success" && <SuccessStep orderNumber={checkoutResult?.orderNumber ?? ""} />}
      </div>
    </main>
  )
}
