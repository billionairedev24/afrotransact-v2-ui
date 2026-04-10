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
  Plus,
  Check,
  Home,
  Building2,
  Clock,
  Truck,
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
import { logError } from "@/lib/errors"
import {
  checkout as apiCheckout,
  mergeCart,
  getRegions,
  loadCheckoutShippingContext,
  createAddress,
  getUserProfile,
  validateCoupon,
  getShippingQuotes,
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
  type ShippingQuoteOption,
  type ShippingQuoteResponse,
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

/** Checkout API may return internal provider ids; keep the heading buyer-friendly. */
function shippingOptionsHeading(shippingProvider: string | undefined | null): string {
  const p = (shippingProvider ?? "").toLowerCase()
  if (p === "shippo" || p === "easypost") return "Live carrier rates"
  const t = shippingProvider?.trim()
  return t && t.length > 0 ? t : "Live carrier rates"
}

const STEPS: { id: Step; label: string; icon: typeof MapPin }[] = [
  { id: "address", label: "Shipping",  icon: MapPin     },
  { id: "review",  label: "Review",    icon: Package    },
  { id: "payment", label: "Payment",   icon: CreditCard },
]

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function AddressStep({ onNext, token, sessionName }: { onNext: (addr: Record<string, string>) => void; token: string | null; sessionName: string }) {
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [shipToOther, setShipToOther] = useState(false)
  // Separate recipient override — never mutates the profile-sourced form fields
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [recipientAddressQuery, setRecipientAddressQuery] = useState("")
  const [recipientAddress, setRecipientAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [makeDefault, setMakeDefault] = useState(false)
  const [form, setForm] = useState({
    fullName: sessionName, line1: "", line2: "", city: "", state: "", zip: "", phone: "",
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
          fullName: name || sessionName || prev.fullName,
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
    const usingRecipientAddr = shipToOther && recipientAddress.line1.trim()
    onNext({
      // Only pass shippingAddressId if using the saved address (not an override address)
      ...(usingRecipientAddr ? {} : { shippingAddressId: addr.id }),
      fullName: shipToOther && recipientName.trim() ? recipientName.trim() : form.fullName,
      line1: usingRecipientAddr ? recipientAddress.line1 : addr.line1,
      line2: usingRecipientAddr ? recipientAddress.line2 : addr.line2 || "",
      city: usingRecipientAddr ? recipientAddress.city : addr.city,
      state: usingRecipientAddr ? recipientAddress.state : addr.state || "",
      zip: usingRecipientAddr ? recipientAddress.zip : addr.postalCode || "",
      phone: shipToOther ? recipientPhone.trim() : form.phone || "",
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
      logError(e, "saving address")
      toast.error("Could not save address. Check required fields and try again.")
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, placeholder = "", inputMode?: "numeric" | "tel" | "email" | "text" | "decimal" | "search" | "url" | "none") => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10 transition-all"
      />
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-[88px] rounded-2xl border border-gray-100 bg-gray-50 animate-pulse" />
        ))}
        <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    )
  }

  /* ── New address form ───────────────────────────────────────────── */
  if (showNew) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {savedAddresses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back
            </button>
          )}
          <h2 className="text-lg font-bold text-gray-900">
            {savedAddresses.length > 0 ? "Add a new address" : "Delivery address"}
          </h2>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field("Full name", "fullName", "Jane Doe")}
            {field("Phone", "phone", "+1 (555) 000-0000", "tel")}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Street address</label>
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
            {field("State", "state", "TX")}
          </div>

          {field("ZIP code", "zip", "78701", "numeric")}

          <label className="flex items-center gap-2.5 cursor-pointer group pt-1">
            <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${makeDefault ? "bg-primary border-primary" : "border-gray-300 group-hover:border-primary/50"}`}>
              {makeDefault && <Check className="h-3 w-3 text-[#0f0f10]" strokeWidth={3} />}
            </div>
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
              className="sr-only"
            />
            <span className="text-sm text-gray-600">Set as my default address</span>
          </label>
        </div>

        <button
          disabled={!form.fullName || !form.line1 || !form.city || !form.zip || saving}
          onClick={handleSaveNew}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <>Use this address <ChevronRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    )
  }

  /* ── Saved addresses list ───────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Choose a delivery address</h2>

      <div className="space-y-2.5">
        {savedAddresses.map((addr) => {
          const isSelected = selectedId === addr.id
          const icon = addr.label?.toLowerCase().includes("work") || addr.label?.toLowerCase().includes("office")
            ? Building2
            : Home
          const Icon = icon
          return (
            <button
              key={addr.id}
              type="button"
              onClick={() => setSelectedId(addr.id)}
              className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? "bg-primary/20" : "bg-gray-100"
                }`}>
                  <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-gray-500"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 capitalize">
                      {addr.label || "Home"}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-snug">
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}
                  </p>
                  <p className="text-sm text-gray-500">
                    {addr.city}, {addr.state} {addr.postalCode}
                  </p>
                </div>

                <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? "border-primary bg-primary" : "border-gray-300"
                }`}>
                  {isSelected && <div className="h-2 w-2 rounded-full bg-[#0f0f10]" />}
                </div>
              </div>
            </button>
          )
        })}

        {/* Add new address card */}
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="w-full rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 group-hover:bg-primary/10 transition-colors">
              <Plus className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-500 group-hover:text-primary transition-colors">
              Add a new address
            </span>
          </div>
        </button>
      </div>

      {/* Ship to someone else — only expanded on demand */}
      {selectedId && (
        <div>
          {!shipToOther ? (
            <button
              type="button"
              onClick={() => setShipToOther(true)}
              className="text-sm text-gray-500 hover:text-primary transition-colors"
            >
              Ship to someone else?
            </button>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Ship to someone else</p>
                <button
                  type="button"
                  onClick={() => {
                    setShipToOther(false)
                    setRecipientName("")
                    setRecipientPhone("")
                    setRecipientAddressQuery("")
                    setRecipientAddress({ line1: "", line2: "", city: "", state: "", zip: "" })
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Recipient name</label>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone (optional)</label>
                  <input
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    inputMode="tel"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-3">
                <p className="text-xs font-medium text-gray-500">Delivery address</p>
                <p className="text-xs text-gray-400 -mt-2">Leave blank to use the selected address above</p>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Street address</label>
                  <AddressAutocomplete
                    value={recipientAddressQuery}
                    onChange={setRecipientAddressQuery}
                    onSelect={(parts) => {
                      setRecipientAddress((prev) => ({
                        ...prev,
                        line1: parts.line1,
                        line2: parts.line2 || prev.line2,
                        city: parts.city || prev.city,
                        state: parts.state || prev.state,
                        zip: parts.zip || prev.zip,
                      }))
                      setRecipientAddressQuery(parts.line1)
                    }}
                    placeholder="Start typing an address…"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Apt, suite, unit (optional)</label>
                  <input
                    value={recipientAddress.line2}
                    onChange={(e) => setRecipientAddress((prev) => ({ ...prev, line2: e.target.value }))}
                    placeholder="Apt 4B"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(["city", "state", "zip"] as const).map((k) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 capitalize">{k === "zip" ? "ZIP" : k}</label>
                      <input
                        value={recipientAddress[k]}
                        onChange={(e) => setRecipientAddress((prev) => ({ ...prev, [k]: e.target.value }))}
                        placeholder={k === "zip" ? "78701" : k === "state" ? "TX" : "Austin"}
                        inputMode={k === "zip" ? "numeric" : undefined}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        disabled={!selectedId}
        onClick={handleUseSaved}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Deliver to this address <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function ReviewStep({
  address, onNext, onBack, items, subtotal, tax, shipping, total, placing, error: placeError,
  couponCode, couponResult, couponLoading, couponError, onApplyCoupon, onRemoveCoupon, onCouponCodeChange, discount,
  couponsEnabled, availableDeals, appliedDeal, onApplyDeal, onRemoveDeal, shippingByStore,
  quoteData, selectedQuoteId, onSelectQuote, freeShippingApplies,
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
  quoteData: ShippingQuoteResponse | null
  selectedQuoteId: string | null
  onSelectQuote: (quoteId: string) => void
  freeShippingApplies: boolean
}) {
  const realtimeOptions = (quoteData?.groups ?? []).flatMap((g) => g.options ?? [])
  const selectedQuote = realtimeOptions.find((q) => q.quoteId === selectedQuoteId) ?? null
  const effectiveShipping = freeShippingApplies ? 0 : selectedQuote ? selectedQuote.amountCents : shipping
  const effectiveTotal = freeShippingApplies ? total : selectedQuote ? total + (selectedQuote.amountCents - shipping) : total
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Review Your Order</h2>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-gray-900">Delivering to</span>
        </div>
        <p className="text-sm font-semibold text-gray-900">{address.fullName}</p>
        <p className="text-sm text-gray-500 mt-0.5">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
        <p className="text-sm text-gray-500">{address.city}, {address.state} {address.zip}</p>
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
        {freeShippingApplies && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm font-medium text-green-800">Your order qualifies for free shipping</span>
          </div>
        )}

        {!freeShippingApplies && quoteData?.realtimeEnabled && quoteData.eligibleByGeo && (quoteData.groups?.length ?? 0) > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Choose delivery speed</p>
              {quoteData.packageCount && quoteData.packageCount > 1 && (
                <span className="text-xs text-gray-500">{quoteData.packageCount} packages</span>
              )}
            </div>
            {(quoteData.groups ?? []).flatMap((group) =>
              group.options.map((opt) => {
                const isSelected = selectedQuoteId === opt.quoteId
                const isFastest = opt.tier === "express" || opt.tier === "overnight"
                const isStandard = opt.tier === "standard" || opt.tier === "ground"
                const TierIcon = isFastest ? Zap : isStandard ? Truck : Clock
                return (
                  <label
                    key={opt.quoteId}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => onSelectQuote(opt.quoteId)}
                      className="sr-only"
                    />
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isSelected ? "bg-primary/20" : "bg-gray-100"
                    }`}>
                      <TierIcon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-gray-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{opt.serviceName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{group.carrier} · {opt.estimatedDays} day{opt.estimatedDays !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {opt.amountCents === 0 ? (
                        <span className="text-sm font-bold text-green-600">FREE</span>
                      ) : (
                        <span className="text-sm font-bold text-gray-900">{formatCents(opt.amountCents)}</span>
                      )}
                    </div>
                    <div className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-gray-300"
                    }`}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-[#0f0f10]" />}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        )}

        {!freeShippingApplies && quoteData?.realtimeEnabled && quoteData.eligibleByGeo && quoteData.message && (quoteData.groups?.length ?? 0) === 0 && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-800">{quoteData.message}</span>
          </div>
        )}
        {!freeShippingApplies && quoteData?.realtimeEnabled && !quoteData.eligibleByGeo && quoteData.message && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700">{quoteData.message}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span><span>{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          <span className="text-green-400">
            {effectiveShipping === 0 ? "Free" : formatCents(effectiveShipping)}
          </span>
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
          <span>Total</span><span>{formatCents(effectiveTotal)}</span>
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
        <button
          onClick={onNext}
          disabled={
            placing ||
            (!freeShippingApplies &&
              quoteData?.realtimeEnabled &&
              quoteData.eligibleByGeo &&
              (quoteData.groups?.length ?? 0) > 0 &&
              !selectedQuoteId)
          }
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-70"
        >
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
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuoteResponse | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
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
  /** Matches static shipping math: at/above threshold, weight-based shipping is $0 (realtime quotes skipped on review). */
  const freeShippingApplies = subtotal >= freeShippingThreshold
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
        const validRegions = allRegions.filter((r) => r.code)
        setAvailableRegions(validRegions)
        setAllDeals(deals)
        const defaultCode = process.env.NEXT_PUBLIC_DEFAULT_REGION_CODE
        const initial =
          (defaultCode ? validRegions.find((r) => r.code === defaultCode) : null) ??
          validRegions[0]
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
      logError(e, "validating coupon")
      setCouponError("Could not validate coupon")
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
        lengthIn: item.lengthIn ?? null,
        widthIn: item.widthIn ?? null,
        heightIn: item.heightIn ?? null,
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
        dealId: appliedDeal?.id,
        selectedShippingQuoteId: selectedQuoteId || undefined,
        selectedShippingCarrier: shippingQuotes?.groups.flatMap((g) => g.options).find((o) => o.quoteId === selectedQuoteId)?.carrier,
        selectedShippingService: shippingQuotes?.groups.flatMap((g) => g.options).find((o) => o.quoteId === selectedQuoteId)?.serviceCode,
        selectedShippingAmountCents: shippingQuotes?.groups.flatMap((g) => g.options).find((o) => o.quoteId === selectedQuoteId)?.amountCents,
      })

      setCheckoutResult(result)
      setStep("payment")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/auth/login?callbackUrl=/checkout")
        return
      }
      logError(e, "checkout")
      setPlaceError(
        e instanceof ApiError && e.body
          ? e.body
          : "Checkout failed. Please try again.",
      )
    } finally {
      setPlacing(false)
    }
  }

  const handlePaymentComplete = useCallback(() => {
    clearCart()
    setStep("success")
  }, [clearCart])

  const currentIdx = STEPS.findIndex((s) => s.id === step)

  useEffect(() => {
    if (step !== "review") return
    if (!authToken || !region) return
    if (freeShippingApplies) {
      setShippingQuotes(null)
      setSelectedQuoteId(null)
      return
    }
    if (!address.state && !address.city) return
    let cancelled = false
    ;(async () => {
      try {
        const q = await getShippingQuotes(authToken, {
          regionId: region.id,
          state: address.state,
          city: address.city,
          destinationLine1: address.line1,
          destinationZip: address.zip,
          destinationCountry: "US",
        })
        if (cancelled) return
        setShippingQuotes(q)
        const first = q.groups?.[0]?.options?.[0]?.quoteId
        setSelectedQuoteId((prev) => prev ?? first ?? null)
      } catch {
        if (!cancelled) {
          setShippingQuotes(null)
          setSelectedQuoteId(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, authToken, region, address.state, address.city, address.zip, freeShippingApplies])

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
          <AddressStep
            token={authToken}
            sessionName={session?.data?.user?.name ?? ""}
            onNext={(addr) => { setAddress(addr); setStep("review") }}
          />
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
            quoteData={shippingQuotes}
            selectedQuoteId={selectedQuoteId}
            onSelectQuote={setSelectedQuoteId}
            freeShippingApplies={freeShippingApplies}
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
