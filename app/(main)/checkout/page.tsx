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
  Tag,
  Zap,
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
import { toast } from "sonner"
import {
  checkout as apiCheckout,
  mergeCart,
  getRegions,
  loadCheckoutShippingContext,
  createAddress,
  getUserProfile,
  validateCoupon,
  ApiError,
  type CheckoutResponse,
  type ValidateCouponResponse,
  type Region,
  type UserAddress,
  type FeatureFlag,
  getRegionFeatures,
  getActiveDeals,
  type DealData,
  type RegionPaymentMethod,
  getRegionConfig,
} from "@/lib/api"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder"
)

const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#EAB308",
    colorBackground: "#FFFFFF",
    colorText: "#171717",
    colorDanger: "#DC2626",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
  },
  rules: {
    ".Input": { border: "1px solid #E5E5E5", padding: "10px 14px" },
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
    if (!token) {
      setLoading(false)
      setShowNew(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { profile, addresses: addrs, addressesUnavailable } =
          await loadCheckoutShippingContext(token)
        if (cancelled) return
        if (addressesUnavailable) {
          toast.message(
            "Saved addresses could not be loaded. You can enter a shipping address below.",
            { duration: 6500 },
          )
        }
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
        setShowNew(addrs.length === 0)
      } catch {
        if (!cancelled) {
          setShowNew(true)
          toast.error("Could not load your account or addresses. Enter a shipping address to continue.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
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
    const inline = {
      fullName: form.fullName,
      line1: form.line1,
      line2: form.line2,
      city: form.city,
      state: form.state,
      zip: form.zip,
      phone: form.phone,
    }
    try {
      try {
        await getUserProfile(token)
        const created = await createAddress(token, {
          label: "shipping",
          line1: form.line1.trim(),
          line2: form.line2?.trim() || undefined,
          city: form.city.trim(),
          state: form.state?.trim() || "",
          postalCode: form.zip.trim(),
          countryCode: "US",
          isDefault: makeDefault || savedAddresses.length === 0,
        })
        onNext({
          shippingAddressId: created.id,
          ...inline,
        })
        return
      } catch (e) {
        const addrEndpointDown =
          e instanceof ApiError && (e.status === 404 || e.status === 502 || e.status === 503)
        if (!addrEndpointDown) throw e
        toast.warning(
          "Could not reach your saved addresses. Continuing with this address for this order only.",
        )
        onNext({
          ...inline,
          skipProfileSave: "1",
        })
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.body
          : e instanceof Error
            ? e.message
            : "Could not save address. Check required fields and try again."
      toast.error(msg.length > 200 ? `${msg.slice(0, 200)}…` : msg)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
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
      <h2 className="text-lg font-bold text-gray-900">Shipping Address</h2>

      {savedAddresses.length > 0 && !showNew && (
        <>
          <div className="space-y-2">
            {savedAddresses.map((addr) => (
              <button
                key={addr.id}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedId === addr.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={selectedId === addr.id}
                      onChange={() => setSelectedId(addr.id)}
                      className="h-4 w-4 rounded border-gray-300 bg-gray-50 text-primary accent-primary"
                    />
                    <span className="text-sm font-medium text-gray-900">{addr.label || "Address"}</span>
                  </div>
                  {addr.isDefault && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                <p className="text-sm text-gray-500">{addr.city}, {addr.state} {addr.postalCode}</p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Shipping Contact</p>
            <div className="grid grid-cols-2 gap-3">
              {field("Full name", "fullName", "Jane Doe")}
              {field("Phone", "phone", "(512) 555-0123")}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              disabled={!selectedId || !form.fullName}
              onClick={handleUseSaved}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors self-start"
            >
              + Ship to a new address
            </button>
          </div>
        </>
      )}

      {(showNew || savedAddresses.length === 0) && (
        <>
          {savedAddresses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="mb-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              &larr; Back to saved addresses
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {field("Full name", "fullName", "Jane Doe")}
            {field("Phone", "phone", "(512) 555-0123")}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
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
              className="h-4 w-4 rounded border-gray-300 bg-gray-50 text-primary accent-primary"
            />
            <span className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
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
  address, onNext, onBack, items, subtotal, tax, shipping, total, placing, error: placeError,
  couponCode, couponResult, couponLoading, couponError, onApplyCoupon, onRemoveCoupon, onCouponCodeChange, discount,
  couponsEnabled, availableDeals, appliedDeal, onApplyDeal, onRemoveDeal, shippingByStore
}: {
  address: Record<string, string>
  onNext: () => void
  onBack: () => void
  items: { variantId: string; title: string; price: number; quantity: number; imageUrl?: string }[]
  subtotal: number; tax: number; shipping: number; total: number
  placing: boolean; error: string | null
  couponCode: string
  couponResult: ValidateCouponResponse | null
  couponLoading: boolean
  couponError: string
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onCouponCodeChange: (code: string) => void
  discount: number
  couponsEnabled: boolean
  availableDeals: DealData[]
  appliedDeal: DealData | null
  onApplyDeal: (deal: DealData) => void
  onRemoveDeal: () => void
  shippingByStore: Map<string, { storeName: string; shippingCents: number }>
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Review Your Order</h2>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-gray-900">Shipping to</span>
        </div>
        <p className="text-sm text-gray-600">{address.fullName}</p>
        <p className="text-sm text-gray-600">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
        <p className="text-sm text-gray-600">{address.city}, {address.state} {address.zip}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900 mb-3">Items</p>
        {items.map((item) => (
          <div key={item.variantId} className="flex justify-between text-sm">
            <span className="text-gray-600 truncate max-w-[220px]">{item.title} x {item.quantity}</span>
            <span className="text-gray-900 font-medium shrink-0 ml-2">{formatCents(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Coupon code */}
      {couponsEnabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-gray-900">Promo Code</span>
          </div>
          {couponResult ? (
            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-green-700">{couponResult.code}</p>
                <p className="text-xs text-green-600">-{formatCents(couponResult.discountCents)} off</p>
              </div>
              <button onClick={onRemoveCoupon} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/60 transition-colors"
              />
              <button
                onClick={onApplyCoupon}
                disabled={!couponCode.trim() || couponLoading}
                className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-500">{couponError}</p>}
        </div>
      )}

      {/* Available Deals */}
      {availableDeals.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-gray-900">Available Deals</span>
          </div>
          <div className="space-y-2">
            {availableDeals.map((deal: DealData) => {
              const isApplied = appliedDeal?.id === deal.id
              return (
                <div key={deal.id} className="flex items-center justify-between rounded-xl border border-primary/20 bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{deal.title}</p>
                    <p className="text-xs text-gray-500">{deal.description || "Limited time offer"}</p>
                    <p className="text-xs font-bold text-primary mt-0.5">
                      {deal.discountPercent ? `${deal.discountPercent}% OFF` : deal.dealPriceCents ? `Special Price: ${formatCents(deal.dealPriceCents)}` : "Special Deal"}
                    </p>
                  </div>
                  {isApplied ? (
                    <button onClick={onRemoveDeal} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Applied</button>
                  ) : (
                    <button 
                      onClick={() => onApplyDeal(deal)}
                      className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
              )
            }) }
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span><span>{formatCents(subtotal)}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Shipping</span><span className="text-green-400">{shipping === 0 ? "Free" : formatCents(shipping)}</span>
          </div>
          {shippingByStore.size > 1 && Array.from(shippingByStore.entries()).map(([sid, v]) => (
            <div key={sid} className="flex justify-between text-xs text-gray-400 pl-2">
              <span>{v.storeName}</span><span>{formatCents(v.shippingCents)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Tax</span><span>{formatCents(tax)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Discount</span>
            <span className="text-green-600 font-medium">-{formatCents(discount)}</span>
          </div>
        )}
        {appliedDeal && (
          <div className="flex justify-between text-sm text-primary">
            <span>Deal: {appliedDeal.title}</span>
            <span className="font-medium">
              -{formatCents(
                appliedDeal.discountPercent 
                  ? Math.round(subtotal * (appliedDeal.discountPercent / 100)) 
                  : (appliedDeal.originalPriceCents && appliedDeal.dealPriceCents) 
                    ? appliedDeal.originalPriceCents - appliedDeal.dealPriceCents 
                    : 0
              )}
            </span>
          </div>
        )}
        <div className="my-2 border-t border-gray-200" />
        <div className="flex justify-between text-gray-900 font-bold">
          <span>Total</span><span>{formatCents(total)}</span>
        </div>
      </div>

      {placeError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-600">{placeError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={placing} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40">
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
  onBack, onComplete, totalCents, clientSecret, stripeAvailable, paymentMethods,
}: {
  onBack: () => void
  onComplete: () => void
  totalCents: number
  clientSecret: string | null
  stripeAvailable: boolean
  paymentMethods: RegionPaymentMethod[]
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
      <h2 className="text-lg font-bold text-gray-900">Payment</h2>

      {stripeAvailable ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="text-emerald-400 font-semibold">Card data never touches our servers.</span>{" "}
              Payment details are encrypted and sent directly to Stripe via a secure iframe.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-gray-500 font-medium">Secured by Stripe</span>
            </div>
            <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
          </div>
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
              <p className="font-semibold text-gray-800">Configured payment providers for this region:</p>
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
                Web checkout for these methods is not yet wired up. Please contact support or try again later.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-700">
              No payment methods are configured for this region yet. Please contact support or try again later.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex justify-between text-sm">
        <span className="text-gray-600 font-medium">Total to be charged</span>
        <span className="text-gray-900 font-bold">{formatCents(totalCents)}</span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={processing} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40">Back</button>
        <button onClick={handlePay} disabled={processing || !stripe || !stripeAvailable} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
          {processing ? (
            <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-[#0f0f10]/30 border-t-[#0f0f10] rounded-full animate-spin" /> Processing…</span>
          ) : (
            <><Lock className="h-3.5 w-3.5" /> Pay {formatCents(totalCents)}</>
          )}
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-600">
        By completing payment you agree to our{" "}
        <a href="/terms" className="underline hover:text-gray-500">Terms of Service</a> and{" "}
        <a href="/privacy" className="underline hover:text-gray-500">Privacy Policy</a>.
      </p>
    </div>
  )
}

function PaymentStep({
  onBack, onComplete, total, clientSecret, stripeAvailable, paymentMethods,
}: {
  onBack: () => void
  onComplete: () => void
  total: number
  clientSecret: string | null
  stripeAvailable: boolean
  paymentMethods: RegionPaymentMethod[]
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
      <StripePaymentForm
        onBack={onBack}
        onComplete={onComplete}
        totalCents={total}
        clientSecret={clientSecret}
        stripeAvailable={stripeAvailable}
        paymentMethods={paymentMethods}
      />
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
        <h2 className="text-xl font-bold text-gray-900">Order placed!</h2>
        <p className="text-gray-500 text-sm mt-1">Order #{orderNumber}</p>
        <p className="text-gray-500 text-sm mt-1">You&apos;ll receive a confirmation email shortly.</p>
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={() => router.push("/orders")} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors">
          View Orders
        </button>
        <button onClick={() => router.push("/")} className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
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
  const [couponResult, setCouponResult] = useState<ValidateCouponResponse | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")

  const cartItems = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const clearCart = useCartStore((s) => s.clearCart)

  const [availableRegions, setAvailableRegions] = useState<Region[]>([])
  const [region, setRegion] = useState<Region | null>(null)
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [paymentMethods, setPaymentMethods] = useState<RegionPaymentMethod[]>([])
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [allDeals, setAllDeals] = useState<DealData[]>([])
  const [appliedDeal, setAppliedDeal] = useState<DealData | null>(null)

  const subtotal = getSubtotal()
  const taxRate = region?.taxRate ?? 0.0825
  const shippingRateCentsPerLb = region?.shippingRateCentsPerLb ?? 599
  const freeShippingThreshold = region?.freeShippingThresholdCents ?? 7500
  const KG_TO_LBS = 2.20462
  // Group shipping by store, matching backend logic
  const shippingByStore = new Map<string, { storeName: string; shippingCents: number }>()
  if (subtotal < freeShippingThreshold) {
    for (const item of cartItems) {
      const weightLbs = (item.weightKg ? item.weightKg * KG_TO_LBS : 1.0) * item.quantity
      const prev = shippingByStore.get(item.storeId)
      const cents = Math.round(weightLbs * shippingRateCentsPerLb)
      shippingByStore.set(item.storeId, {
        storeName: prev?.storeName ?? item.storeName,
        shippingCents: (prev?.shippingCents ?? 0) + cents,
      })
    }
  }
  const shipping = Array.from(shippingByStore.values()).reduce((s, v) => s + v.shippingCents, 0)
  const tax = Math.round(subtotal * taxRate)
  const discount = couponResult?.discountCents ?? 0
  const dealDiscount = appliedDeal 
    ? (appliedDeal.discountPercent 
        ? Math.round(subtotal * (appliedDeal.discountPercent / 100))
        : (appliedDeal.originalPriceCents && appliedDeal.dealPriceCents)
          ? appliedDeal.originalPriceCents - appliedDeal.dealPriceCents
          : 0)
    : 0
  const total = subtotal + tax + shipping - discount - dealDiscount

  const availableDeals = allDeals.filter(d => cartItems.some(i => i.productId === d.productId))

  // Prefer config-service features for visibility; default to disabled when missing
  const [configFeatures, setConfigFeatures] = useState<Record<string, boolean>>({})
  const couponsEnabled = configFeatures["coupons_enabled"] === true
  const stripeFeatureEnabled =
    flags.find((f) => f.key === "stripe_enabled" || f.key === "stripe")?.enabled ?? true
  const stripeRow = paymentMethods.find((m) => m.provider.toLowerCase() === "stripe")
  const stripeMethodEnabled = stripeRow ? stripeRow.enabled : paymentMethods.length === 0
  const stripeAvailable = stripeFeatureEnabled && stripeMethodEnabled

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (cartItems.length === 0 && step !== "success") {
      router.replace("/cart")
    }
  }, [mounted, cartItems.length, step, router])

  // Fetch auth token, all active regions, and deals once on mount.
  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    async function init() {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        setAuthToken(token)
        const [allRegions, deals] = await Promise.all([
          getRegions(token, true),
          getActiveDeals().catch((): DealData[] => []),
        ])
        if (cancelled) return
        setAvailableRegions(allRegions)
        setAllDeals(deals)
        const defaultCode = process.env.NEXT_PUBLIC_DEFAULT_REGION_CODE
        const initial =
          (defaultCode ? allRegions.find((r) => r.code === defaultCode) : null) ??
          allRegions[0]
        if (initial) setRegion(initial)
      } catch {
        // fall back to hardcoded defaults
      }
    }
    init()
    return () => { cancelled = true }
  }, [mounted])

  // Re-fetch region-specific config (features, payment methods) whenever the selected region changes.
  useEffect(() => {
    if (!region) return
    const currentRegion = region
    let cancelled = false
    async function loadRegionConfig() {
      const [f, cfg] = await Promise.all([
        getRegionFeatures(currentRegion.id).catch((): FeatureFlag[] => []),
        getRegionConfig(currentRegion.code).catch(() => null),
      ])
      if (cancelled) return
      setFlags(f)
      if (cfg) {
        setPaymentMethods(cfg.paymentMethods || [])
        setConfigFeatures(cfg.features || {})
      } else {
        setPaymentMethods([])
        setConfigFeatures({})
      }
      // Reset any applied coupon — it may not be valid in the new region.
      setCouponCode("")
      setCouponResult(null)
      setCouponError("")
    }
    loadRegionConfig()
    return () => { cancelled = true }
  }, [region])

  async function handleApplyCoupon() {
    if (!couponsEnabled) return
    if (!couponCode.trim() || !authToken) return
    setCouponLoading(true)
    setCouponError("")
    setCouponResult(null)
    try {
      const result = await validateCoupon(authToken, couponCode.trim(), subtotal, region?.id)
      if (result.valid) {
        setCouponResult(result)
      } else {
        setCouponError(result.error || "Invalid coupon code")
      }
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : "Could not validate coupon")
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setCouponCode("")
    setCouponResult(null)
    setCouponError("")
  }

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
        weightKg: item.weightKg ?? null,
      }))

      await mergeCart(token, items)

      if (!region) {
        setPlaceError("Unable to load region configuration. Please refresh and try again.")
        setPlacing(false)
        return
      }

      const codes: string[] = []
      if (couponResult) codes.push(couponCode.trim())
      if (appliedDeal?.couponCode) codes.push(appliedDeal.couponCode)

      const wantsSaveProfile =
        address.skipProfileSave !== "1" &&
        !address.shippingAddressId &&
        Boolean(address.line1?.trim() && address.city?.trim() && address.zip?.trim())

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
        saveAddress: wantsSaveProfile,
        couponCodes: codes.length > 0 ? codes : undefined,
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="h-32 flex items-center justify-center text-gray-500">Loading…</div>
        </div>
      </main>
    )
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-[680px] px-4 sm:px-6 py-16 text-center">
        <Lock className="mx-auto h-12 w-12 text-gray-500" />
        <h1 className="text-xl font-bold text-gray-900 mt-4">Sign in to checkout</h1>
        <p className="text-gray-500 text-sm mt-2">Your cart items will be preserved.</p>
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      {availableRegions.length > 1 && step !== "success" && (
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
          <select
            value={region?.id ?? ""}
            onChange={(e) => {
              const r = availableRegions.find((r) => r.id === e.target.value)
              if (r) setRegion(r)
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"
          >
            {availableRegions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {step !== "success" && (
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => {
            const done   = currentIdx > i
            const active = s.id === step
            const Icon   = s.icon
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${done ? "bg-green-500" : active ? "bg-primary" : "bg-gray-100"}`}>
                    {done ? <CheckCircle className="h-5 w-5 text-white" /> : <Icon className={`h-4 w-4 ${active ? "text-[#0f0f10]" : "text-gray-500"}`} />}
                  </div>
                  <span className={`text-[11px] font-medium ${active ? "text-gray-900" : done ? "text-green-400" : "text-gray-500"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${currentIdx > i ? "bg-green-500" : "bg-gray-100"}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
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
            tax={checkoutResult?.taxCents ?? tax}
            shipping={checkoutResult?.shippingCostCents ?? shipping}
            total={displayTotal}
            placing={placing}
            error={placeError}
            couponCode={couponCode}
            couponResult={couponResult}
            couponLoading={couponLoading}
            couponError={couponError}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
            onCouponCodeChange={setCouponCode}
            discount={discount}
            couponsEnabled={couponsEnabled}
            availableDeals={availableDeals}
            appliedDeal={appliedDeal}
            onApplyDeal={(deal) => setAppliedDeal(deal)}
            onRemoveDeal={() => setAppliedDeal(null)}
            shippingByStore={shippingByStore}
          />
        )}
        {step === "payment" && (
          <PaymentStep
            onBack={() => setStep("review")}
            onComplete={handlePaymentComplete}
            total={displayTotal}
            clientSecret={checkoutResult?.paymentClientSecret ?? null}
            stripeAvailable={stripeAvailable}
            paymentMethods={paymentMethods}
          />
        )}
        {step === "success" && <SuccessStep orderNumber={checkoutResult?.orderNumber ?? ""} />}
      </div>
    </main>
  )
}
