"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  MapPin,
  Package,
  Lock,
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
  Edit2,
  ShieldCheck,
  X,
  ArrowLeft,
  Truck as TruckIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
// Stripe (~80KB of @stripe/react-stripe-js + @stripe/stripe-js) only loads when
// the shopper actually reaches the payment step. Earlier steps (address, review)
// get a lighter initial bundle.
const PaymentStep = dynamic(() => import("./_stripe-payment"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="h-6 w-40 rounded bg-muted animate-pulse" />
      <div className="h-48 w-full rounded-2xl bg-muted animate-pulse" />
      <div className="flex gap-3">
        <div className="h-12 flex-1 rounded-xl bg-muted animate-pulse" />
        <div className="h-12 flex-1 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  ),
})
import { useCartStore, clearGuestCart } from "@/stores/cart-store"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"
import { PhoneInput } from "@/components/ui/PhoneInput"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import { features } from "@/lib/features"
import {
  checkout as apiCheckout,
  mergeCart,
  clearServerCart,
  getRegions,
  loadCheckoutShippingContext,
  createAddress,
  getUserProfile,
  validateCoupon,
  getShippingQuotes,
  ApiError,
  type CheckoutResponse,
  type CheckoutShippingContext,
  type ValidateCouponResponse,
  type Region,
  type UserAddress,
  getActiveDeals,
  type DealData,
  type RegionPaymentMethod,
  type ShippingQuoteOption,
  type ShippingQuoteResponse,
  getRegionConfig,
  getStoreById,
  listSavedPaymentMethods,
  pollOrderUntilExists,
  type SavedPaymentMethod,
} from "@/lib/api"
import { resolveDefaultRegion } from "@/lib/regions"

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

function AddressStep({
  onNext,
  token,
  sessionName,
  initialContext,
}: {
  onNext: (addr: Record<string, string>) => void
  token: string | null
  sessionName: string
  initialContext: CheckoutShippingContext | null
}) {
  // Seed state from server-rendered context so the form paints with saved
  // addresses populated on first render — no client round-trip, no skeleton.
  // If the server couldn't prefetch (unauthenticated, transient failure), we
  // fall back to the original client-side useEffect load.
  const seedAddrs = initialContext?.addresses ?? []
  const seedDef = seedAddrs.find((a) => a.isDefault)
  const seedProfile = initialContext?.profile
  const seedName = seedProfile
    ? [seedProfile.firstName, seedProfile.lastName].filter(Boolean).join(" ")
    : ""

  const router = useRouter()
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>(seedAddrs)
  const [selectedId, setSelectedId] = useState<string | null>(
    seedDef?.id ?? seedAddrs[0]?.id ?? null,
  )
  const [showNew, setShowNew] = useState(initialContext ? seedAddrs.length === 0 : false)
  const [shipToOther, setShipToOther] = useState(false)
  // Separate recipient override — never mutates the profile-sourced form fields
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [recipientAddressQuery, setRecipientAddressQuery] = useState("")
  const [recipientAddress, setRecipientAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "" })
  // `loading` is only true when we genuinely need to fetch (no server seed).
  const [loading, setLoading] = useState(!initialContext)
  const [saving, setSaving] = useState(false)
  const [makeDefault, setMakeDefault] = useState(false)
  const [form, setForm] = useState({
    fullName: seedName || sessionName,
    line1: "", line2: "", city: "", state: "", zip: "",
    phone: seedProfile?.phone ?? "",
  })
  const [addressQuery, setAddressQuery] = useState("")

  useEffect(() => {
    // Fast path: the server already gave us the addresses; don't refetch.
    if (initialContext) return

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
  }, [token, initialContext, sessionName])

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

  /* ── New address modal (mockup lines 496-540) ─────────────────────
     If there are no saved addresses, the modal opens immediately as the
     first-time flow. If there are saved addresses, it opens on demand
     from the "+ Add New Address" button below the grid. */
  // First-time checkout opens the address modal automatically. If the buyer
  // decides not to enter one, the close/cancel actions take them back to the
  // cart rather than trapping them on a half-complete checkout page.
  const dismissNewAddress = () => {
    setShowNew(false)
    if (savedAddresses.length === 0) router.push("/cart")
  }
  const newAddressModal = showNew && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismissNewAddress()
      }}
    >
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-foreground">Add New Address</h3>
          <button
            type="button"
            onClick={dismissNewAddress}
            className="text-gray-400 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field("Full name", "fullName", "Jane Doe")}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
              <PhoneInput
                value={form.phone}
                onChange={(e164) => setForm({ ...form, phone: e164 })}
              />
            </div>
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
          {field("ZIP code", "zip", "ZIP", "numeric")}
          <label className="flex items-center gap-2.5 cursor-pointer group pt-1">
            <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${makeDefault ? "bg-brand-gold border-brand-gold" : "border-gray-300 group-hover:border-brand-gold/50"}`}>
              {makeDefault && <Check className="h-3 w-3 text-brand-gold-foreground" strokeWidth={3} />}
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
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={dismissNewAddress}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!form.fullName || !form.line1 || !form.city || !form.zip || saving}
            onClick={handleSaveNew}
            className="px-6 py-2.5 rounded-lg bg-brand-gold text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Address"}
          </button>
        </div>
      </div>
    </div>
  )

  /* ── Saved addresses list (mockup lines 250-308) ───────────────── */
  return (
    <div className="space-y-6">
      {newAddressModal}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savedAddresses.map((addr) => {
          const isSelected = selectedId === addr.id
          return (
            <label
              key={addr.id}
              className="relative cursor-pointer group"
            >
              <input
                type="radio"
                name="address"
                checked={isSelected}
                onChange={() => setSelectedId(addr.id)}
                className="sr-only"
              />
              <div className={cn(
                "relative h-full rounded-lg border-2 p-4 transition-all",
                isSelected
                  ? "border-brand-gold bg-white"
                  : "border-gray-200 bg-white group-hover:border-gray-300",
              )}>
                <div className="absolute top-4 right-4">
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected ? "border-brand-gold" : "border-gray-300",
                  )}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />}
                  </div>
                </div>
                <div className="pr-8">
                  <p className="text-sm font-bold text-foreground">
                    {form.fullName || sessionName || "Saved address"}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-1">
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}
                    <br />
                    {addr.city}, {addr.state} {addr.postalCode}
                    <br />
                    {addr.countryCode || "United States"}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      // Pre-fill the new-address form with this entry then open modal.
                      setForm((prev) => ({
                        ...prev,
                        line1: addr.line1,
                        line2: addr.line2 || "",
                        city: addr.city,
                        state: addr.state || "",
                        zip: addr.postalCode || "",
                      }))
                      setAddressQuery(addr.line1)
                      setShowNew(true)
                    }}
                    className="mt-3 text-xs font-bold uppercase tracking-wider text-brand-gold-foreground/80 hover:text-brand-gold-foreground transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </label>
          )
        })}
      </div>

      {/* Footer row: + Add new address (left) · USE THIS ADDRESS (right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 text-sm font-bold text-brand-gold-foreground/80 hover:text-brand-gold-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add a new address
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={handleUseSaved}
          className="px-6 py-2.5 rounded-full bg-brand-gold text-xs font-bold uppercase tracking-wider text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50"
        >
          Use this address
        </button>
      </div>

      {/* Ship to someone else — only expanded on demand */}
      {selectedId && (
        <div>
          {!shipToOther ? (
            <button
              type="button"
              onClick={() => setShipToOther(true)}
              className="text-sm text-gray-500 hover:text-foreground transition-colors"
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
                        placeholder={k === "zip" ? "ZIP" : k === "state" ? "TX" : "City"}
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

    </div>
  )
}

/**
 * Delivery picker — live carrier shipping is currently disabled, so this
 * always presents a single per-weight standard option. When carrier rating
 * is re-enabled we'll surface multiple tiles here. Backend computes the
 * actual shipping cost server-side and returns it in `displayShipping`
 * (see CheckoutClient's Order Summary). No client-side calculation.
 */
function DeliveryOptions({
  shippingCents,
  onConfirm,
  placing,
}: {
  shippingCents: number
  onConfirm: () => void
  /** True while the parent is placing/syncing the order. */
  placing: boolean
}) {
  // Single tile while carrier-rated shipping is disabled. Selecting it (or
  // re-clicking it) advances to Payment via the same handler the Order
  // Summary CTA uses — no extra button needed.
  return (
    <div className="flex flex-col gap-3">
      <label className="relative cursor-pointer block">
        <input
          type="radio"
          name="delivery"
          checked
          onChange={onConfirm}
          disabled={placing}
          className="sr-only"
        />
        <div
          onClick={onConfirm}
          className="flex items-center justify-between p-4 border-2 border-brand-gold rounded-lg bg-white"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-5 h-5 shrink-0 rounded-full border-2 border-brand-gold flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Standard delivery</p>
              <p className="text-xs text-gray-500 mt-0.5">Delivery in 3-5 business days</p>
            </div>
          </div>
          <span className="text-sm font-semibold whitespace-nowrap ml-3">
            {shippingCents === 0 ? (
              <span className="text-brand-gold">Free</span>
            ) : (
              <span className="text-foreground">${(shippingCents / 100).toFixed(2)}</span>
            )}
          </span>
        </div>
      </label>
    </div>
  )
}

function ReviewStep({
  address, onNext, onBack, items, subtotal, tax, shipping, total, placing, error: placeError,
  couponCode, couponResult, couponLoading, couponError, onApplyCoupon, onRemoveCoupon, onCouponCodeChange, discount,
  couponsEnabled, availableDeals, appliedDeal, onApplyDeal, onRemoveDeal, shippingByStore,
  quoteData, selectedQuoteId, onSelectQuote, freeShippingApplies,
  checkoutBlocked,
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
  checkoutBlocked?: boolean
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
          <MapPin className="h-4 w-4 text-foreground" />
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
            <Tag className="h-4 w-4 text-foreground" />
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
            <Zap className="h-4 w-4 text-foreground" />
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
                    <p className="text-xs font-bold text-foreground mt-0.5">
                      {deal.discountPercent ? `${deal.discountPercent}% OFF` : deal.dealPriceCents ? `Special Price: ${formatCents(deal.dealPriceCents)}` : "Special Deal"}
                    </p>
                  </div>
                  {isApplied ? (
                    <button onClick={onRemoveDeal} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Applied</button>
                  ) : (
                    <button 
                      onClick={() => onApplyDeal(deal)}
                      className="rounded-lg bg-brand-gold/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-brand-gold/20 transition-colors"
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
                      <TierIcon className={`h-5 w-5 ${isSelected ? "text-foreground" : "text-gray-500"}`} />
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
                      {isSelected && <div className="h-2 w-2 rounded-full bg-brand-gold-foreground" />}
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
          <div className="flex justify-between text-sm text-foreground">
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
            Boolean(checkoutBlocked) ||
            placing ||
            (!freeShippingApplies &&
              quoteData?.realtimeEnabled &&
              quoteData.eligibleByGeo &&
              (quoteData.groups?.length ?? 0) > 0 &&
              !selectedQuoteId)
          }
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-70"
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
        <button onClick={() => router.push("/orders")} className="rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors">
          View Orders
        </button>
        <button onClick={() => router.push("/")} className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Continue Shopping
        </button>
      </div>
    </div>
  )
}

export default function CheckoutClient({
  initialContext = null,
}: {
  initialContext?: CheckoutShippingContext | null
}) {
  const session = useSession()
  const status = session?.status
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step | "success">("address")
  // Per-mockup: wizard-style — only the active section is expanded by
  // default. Buyer can still click any header to expand/collapse manually.
  // Auto-sync is handled by a useEffect below that listens to `step`.
  const [expanded, setExpanded] = useState({ address: true, delivery: false, payment: false })
  const [promoOpen, setPromoOpen] = useState(false)
  const [address, setAddress] = useState<Record<string, string>>({})
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null)
  // Backlog #40: when the buyer ticks "Save this card" on the payment step we
  // need the PaymentIntent to carry a Stripe Customer + setup_future_usage.
  // The PI is minted by /orders/checkout, so toggling this flag forces a
  // re-mint of the order (idempotency key is cleared first).
  // Off by default — buyer explicitly opts in to remember the card. Some
  // buyers prefer not to. The picker still surfaces any previously-saved
  // cards even when this is off.
  const [saveCard, setSaveCard] = useState(false)
  // Idempotency-Key reused across retries of the same logical placement so
  // a network blip can't create a second order. Reset when the user goes back.
  const idempotencyKeyRef = useRef<string | null>(null)

  // Helper — fully drop the current placement attempt. Used by every
  // back-navigation handler in the review/payment steps. Without clearing
  // checkoutResult, a stale paymentClientSecret (referencing a PaymentIntent
  // that's been canceled or replaced server-side) lingers in state and
  // Stripe.confirmPayment then 404s with "No such payment_intent" on the next
  // pay attempt (Backlog #40 cleanup).
  const resetCheckoutSession = () => {
    idempotencyKeyRef.current = null
    setCheckoutResult(null)
  }
  // Synchronous in-flight gate. setPlacing(true) only disables the button on
  // the next render, which leaves a same-tick double-click able to re-enter
  // syncCartAndCheckout. The ref is set before the first await so a second
  // call sees `true` immediately and bails.
  const placingRef = useRef(false)
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuoteResponse | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState("")
  const [couponResult, setCouponResult] = useState<ValidateCouponResponse | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")
  const [gatesReady, setGatesReady] = useState(false)

  const cartItems = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const clearCart = useCartStore((s) => s.clearCart)

  const [availableRegions, setAvailableRegions] = useState<Region[]>([])
  const [region, setRegion] = useState<Region | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<RegionPaymentMethod[]>([])
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [allDeals, setAllDeals] = useState<DealData[]>([])
  const [appliedDeal, setAppliedDeal] = useState<DealData | null>(null)
  const [configFeatures, setConfigFeatures] = useState<Record<string, boolean>>({})
  // Per-store return policies. Backlog #39: each store sets its own policy;
  // we render exactly what each store sets, grouped by store. No aggregation.
  const [storeReturnPolicies, setStoreReturnPolicies] = useState<
    Record<string, { name: string; returnsSupported: boolean; returnWindowDays: number | null }>
  >({})

  useEffect(() => {
    const ids = Array.from(new Set(cartItems.map((i) => i.storeId)))
    if (ids.length === 0) return
    let cancelled = false
    Promise.all(
      ids.map((id) =>
        getStoreById(id)
          .then((s) => ({
            id,
            name: s.name,
            returnsSupported: s.returnsSupported === true,
            returnWindowDays: typeof s.returnWindowDays === "number" ? s.returnWindowDays : null,
          }))
          .catch(() => null),
      ),
    ).then((rows) => {
      if (cancelled) return
      const next: Record<string, { name: string; returnsSupported: boolean; returnWindowDays: number | null }> = {}
      for (const r of rows) {
        if (r) next[r.id] = { name: r.name, returnsSupported: r.returnsSupported, returnWindowDays: r.returnWindowDays }
      }
      setStoreReturnPolicies(next)
    })
    return () => { cancelled = true }
  }, [cartItems])

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

  const couponsEnabled = configFeatures["coupons_enabled"] === true
  const stripeFeatureEnabled = features.stripeEnabled()
  const marketplaceFromConfig =
    "marketplace_enabled" in configFeatures ? configFeatures["marketplace_enabled"] === true : undefined
  const marketplacePurchasingAllowed =
    !gatesReady
      ? true
      : marketplaceFromConfig !== undefined
        ? marketplaceFromConfig
        : features.marketplaceEnabled()
  const stripeRow = paymentMethods.find((m) => m.provider.toLowerCase() === "stripe")
  const stripeMethodEnabled = stripeRow ? stripeRow.enabled : paymentMethods.length === 0
  const stripeAvailable = stripeFeatureEnabled && stripeMethodEnabled

  useEffect(() => { setMounted(true) }, [])

  // Auto-advance which section is expanded as the user moves through the flow,
  // so a returning buyer always lands on the relevant section. Manual toggling
  // (via the section header) still works on top of this.
  useEffect(() => {
    if (step === "review") {
      setExpanded((s) => ({ ...s, address: false, delivery: true }))
    } else if (step === "payment") {
      setExpanded((s) => ({ ...s, address: false, delivery: false, payment: true }))
    } else if (step === "address") {
      setExpanded((s) => ({ ...s, address: true }))
    }
  }, [step])

  // Auto-confirm delivery as soon as the user lands on the review step. Live
  // carrier rating is disabled so there's only one option and it's already
  // selected — making the buyer click it is friction. This kicks off the
  // backend checkout sync (which mints the Stripe payment intent), so the
  // Payment section becomes interactable without any extra click.
  // The ref guards against double-firing.
  const autoSyncedRef = useRef(false)
  useEffect(() => {
    if (step !== "review") {
      // Reset the guard if the user goes back to address so a re-edit
      // re-syncs once they return to review.
      if (step === "address") autoSyncedRef.current = false
      return
    }
    if (autoSyncedRef.current) return
    if (gatesReady && !marketplacePurchasingAllowed) return
    autoSyncedRef.current = true
    void syncCartAndCheckout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gatesReady, marketplacePurchasingAllowed])

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
        // Saved cards — soft-fail; payment step still works without them.
        listSavedPaymentMethods(token)
          .then((cards) => {
            if (cancelled) return
            setSavedCards(cards ?? [])
            const def = (cards ?? []).find((c) => c.isDefault)
            // Pre-select nothing — let buyers explicitly choose to use a
            // saved card so the picker isn't accidentally locked in. If you
            // want a default selection, switch to `def?.stripePmId ?? null`.
          })
          .catch(() => { /* no saved cards or endpoint unavailable */ })
        const [allRegions, deals] = await Promise.all([
          getRegions(token, true),
          getActiveDeals().catch((): DealData[] => []),
        ])
        if (cancelled) return
        const validRegions = allRegions.filter((r) => r.code)
        setAvailableRegions(validRegions)
        setAllDeals(deals)
        const defaultCode = process.env.NEXT_PUBLIC_DEFAULT_REGION_CODE ?? ""
        const initial =
          (defaultCode ? validRegions.find((r) => r.code === defaultCode) : undefined)
            ?? resolveDefaultRegion(validRegions)
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
    setGatesReady(false)
    async function loadRegionConfig() {
      try {
        const cfg = await getRegionConfig(currentRegion.code).catch(() => null)
        if (cancelled) return
        if (cfg) {
          setPaymentMethods(cfg.paymentMethods || [])
          setConfigFeatures(cfg.features || {})
        } else {
          setPaymentMethods([])
          setConfigFeatures({})
        }
        setCouponCode("")
        setCouponResult(null)
        setCouponError("")
      } finally {
        if (!cancelled) setGatesReady(true)
      }
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
    // Synchronous re-entry guard — protects against double-click, React 18
    // StrictMode double-invokes, and any other path that fires this twice
    // within the same tick before `placing` propagates to disable the button.
    if (placingRef.current) return
    placingRef.current = true
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
        placingRef.current = false
        setPlacing(false)
        return
      }

      if (gatesReady && !marketplacePurchasingAllowed) {
        setPlaceError("Purchasing is temporarily unavailable right now. Please try again soon.")
        placingRef.current = false
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

      // Idempotency-Key persists across the placement attempt — if the user clicks
      // again or the network blips, the backend returns the same checkout result
      // instead of creating a second order / PaymentIntent.
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID()
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
        saveAddress: wantsSaveProfile,
        couponCodes: codes.length > 0 ? codes : undefined,
        dealId: appliedDeal?.id,
        selectedShippingQuoteId: selectedQuoteId || undefined,
        selectedShippingCarrier: shippingQuotes?.groups.flatMap((g) => g.options).find((o) => o.quoteId === selectedQuoteId)?.carrier,
        selectedShippingService: shippingQuotes?.groups.flatMap((g) => g.options).find((o) => o.quoteId === selectedQuoteId)?.serviceCode,
        selectedShippingAmountCents: shippingQuotes?.groups.flatMap((g) => g.options).find((o) => o.quoteId === selectedQuoteId)?.amountCents,
        saveCard,
      }, idempotencyKeyRef.current)

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
      placingRef.current = false
      setPlacing(false)
    }
  }

  const handlePaymentComplete = useCallback(async () => {
    // Phase 3 of cart/checkout rewrite: the order row doesn't exist yet at
    // this point — payment-service's webhook to order-service materializes it
    // via Kafka payment.completed. Poll /orders/by-id/{id} until it appears
    // (typically <2s) so the success screen can show the real order number.
    const orderId = checkoutResult?.orderId
    if (orderId) {
      try {
        const token = await getAccessToken()
        if (token) {
          const materialized = await pollOrderUntilExists(token, orderId)
          if (materialized?.orderNumber) {
            // Patch the displayed orderNumber from the materialized row in
            // case checkoutResult's placeholder differs.
            setCheckoutResult((prev) => prev ? { ...prev, orderNumber: materialized.orderNumber } : prev)
          }
          // If null (timeout), success screen still renders with whatever
          // orderNumber the checkout response carried — the buyer's payment
          // succeeded; the order will appear in /orders once webhook lands.
        }
      } catch (e) {
        logError(e, "poll order after payment")
      }
    }
    try {
      const token = await getAccessToken()
      if (token) {
        await clearServerCart(token)
      }
    } catch (e) {
      logError(e, "clear server cart after payment")
    }
    clearCart()
    try {
      clearGuestCart()
    } catch {
      // sessionStorage/localStorage may be unavailable — non-fatal
    }
    setStep("success")
  }, [clearCart, checkoutResult])

  const currentIdx = STEPS.findIndex((s) => s.id === step)

  useEffect(() => {
    if (step !== "review") return
    if (!authToken || !region) return
    if (gatesReady && !marketplacePurchasingAllowed) {
      setShippingQuotes(null)
      setSelectedQuoteId(null)
      return
    }
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
  }, [step, authToken, region, gatesReady, marketplacePurchasingAllowed, address.state, address.city, address.zip, freeShippingApplies])

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
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-brand-gold-foreground"
        >
          Sign In
        </button>
      </main>
    )
  }

  const displayTotal = checkoutResult?.totalCents ?? total
  const displaySubtotal = checkoutResult?.subtotalCents ?? subtotal
  const displayTax = checkoutResult?.taxCents ?? tax
  const displayShipping = checkoutResult?.shippingCostCents ?? shipping
  const totalDiscount = discount + dealDiscount

  // currentIdx still drives section completion state (silences unused-var lint via this reference)
  void currentIdx

  const addressComplete = step === "review" || step === "payment" || step === "success"
  const reviewComplete = step === "payment" || step === "success"
  const paymentComplete = step === "success"
  const toggle = (k: keyof typeof expanded) => setExpanded((s) => ({ ...s, [k]: !s[k] }))

  // Top-of-summary "Place your order" CTA. It is context-aware:
  //   - on the address step it does nothing (button is disabled there)
  //   - on the review step it advances to payment via the existing handler
  //   - on the payment step Stripe's own confirm flow runs (we don't fire
  //     it from here to keep the iframe-driven flow untouched); the user
  //     uses the inline Pay button rendered by PaymentStep.
  const placeOrderHandler = () => {
    if (step === "review") syncCartAndCheckout()
  }

  if (step === "success") {
    return (
      <main className="mx-auto max-w-[680px] px-4 sm:px-6 py-10">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SuccessStep orderNumber={checkoutResult?.orderNumber ?? ""} />
        </div>
      </main>
    )
  }

  const SectionHeader = ({
    n,
    title,
    open,
    active,
    onToggle,
  }: {
    n: number
    title: string
    open: boolean
    /** True when this is the section the buyer is currently in. */
    active: boolean
    onToggle: () => void
  }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition-colors",
        // Bottom border only when expanded — acts as the section separator.
        open && "border-b border-gray-200",
      )}
    >
      <h2 className="flex items-center gap-3 text-lg font-bold">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
            active
              ? "bg-brand-gold text-brand-gold-foreground"
              : "border-2 border-brand-gold/40 text-brand-gold/70 bg-white",
          )}
        >
          {n}
        </span>
        <span className={cn(active ? "text-foreground" : "text-foreground/50")}>{title}</span>
      </h2>
      <ChevronDown
        className={cn(
          "h-5 w-5 text-foreground/40 transition-transform",
          open ? "rotate-180" : "rotate-0",
        )}
      />
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky brand header — mockup image: back arrow + "Checkout" left,
          lock icon + "SECURE CHECKOUT" gold right. */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Checkout</h1>
          </div>
          <div className="flex items-center gap-2 text-brand-gold-foreground/70">
            <Lock className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Secure checkout</span>
          </div>
        </div>
      </header>

    <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10 py-8 md:py-10">
      {gatesReady && !marketplacePurchasingAllowed && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p>
            Purchasing is paused for updates in your selected region (operators may have turned the marketplace off).
            You can browse, but checkout will stay blocked until marketplace is enabled again.
          </p>
        </div>
      )}

      {availableRegions.length > 1 && (
        <div className="mb-6 flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-gray-500" />
          <select
            value={region?.id ?? ""}
            onChange={(e) => {
              const r = availableRegions.find((r) => r.id === e.target.value)
              if (r) setRegion(r)
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-brand-gold/60 transition-colors"
          >
            {availableRegions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Left column: section cards */}
        <div className="flex-1 w-full flex flex-col gap-6">
          {/* Step 1: Shipping Address */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <SectionHeader
              n={1}
              title="Shipping address"
              active={step === "address"}
              open={expanded.address}
              onToggle={() => toggle("address")}
            />
            {expanded.address && (
            <div className="p-6">
              {step === "address" ? (
                <AddressStep
                  token={authToken}
                  sessionName={session?.data?.user?.name ?? ""}
                  initialContext={initialContext}
                  onNext={(addr) => { setAddress(addr); setStep("review") }}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                      <MapPin className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{address.fullName}</p>
                      <p className="text-sm text-gray-600 leading-snug mt-0.5">
                        {address.line1}{address.line2 ? `, ${address.line2}` : ""}
                      </p>
                      <p className="text-sm text-gray-500">
                        {address.city}, {address.state} {address.zip}
                      </p>
                      {address.phone && (
                        <p className="text-xs text-gray-500 mt-1">{address.phone}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStep("address"); resetCheckoutSession() }}
                    disabled={placing}
                    className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
              )}
            </div>
            )}
          </section>

          {/* Step 2: Delivery Method & Review */}
          <section
            className={cn(
              "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity",
              step === "address" && "opacity-60",
            )}
          >
            <SectionHeader
              n={2}
              title="Delivery options"
              active={step === "review"}
              open={expanded.delivery}
              onToggle={() => toggle("delivery")}
            />
            {expanded.delivery && (
            <div className="p-6">
              {step === "address" ? (
                <p className="text-sm text-gray-500">
                  Select a shipping address above to see delivery options.
                </p>
              ) : step === "review" ? (
                <DeliveryOptions
                  shippingCents={displayShipping}
                  onConfirm={syncCartAndCheckout}
                  placing={placing}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                      <Truck className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {freeShippingApplies ? "Standard Shipping" : "Selected shipping method"}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {displayShipping === 0 ? (
                          <span className="text-brand-gold font-medium">Free</span>
                        ) : (
                          formatCents(displayShipping)
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStep("review"); resetCheckoutSession() }}
                    disabled={placing}
                    className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
              )}
            </div>
            )}
          </section>

          {/* Step 3: Payment */}
          <section
            className={cn(
              "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity",
              step !== "payment" && !paymentComplete && "opacity-60",
            )}
          >
            <SectionHeader
              n={3}
              title="Payment method"
              active={step === "payment"}
              open={expanded.payment}
              onToggle={() => toggle("payment")}
            />
            {expanded.payment && (
            <div className="p-6">
              {step === "payment" ? (
                <PaymentStep
                  onBackAction={() => setStep("review")}
                  onCompleteAction={handlePaymentComplete}
                  total={displayTotal}
                  clientSecret={checkoutResult?.paymentClientSecret ?? null}
                  stripeAvailable={stripeAvailable}
                  paymentMethods={paymentMethods}
                  saveCard={saveCard}
                  onSaveCardChangeAction={(next) => {
                    setSaveCard(next)
                  }}
                  savedCards={savedCards}
                  selectedSavedCardId={selectedSavedCardId}
                  onSelectedSavedCardChangeAction={setSelectedSavedCardId}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  Confirm your delivery method to enter payment details.
                </p>
              )}
            </div>
            )}
          </section>
        </div>

        {/* Right column: Order Summary — image-faithful */}
        <aside className="w-full lg:w-[380px] xl:w-[400px] shrink-0 lg:sticky lg:top-24 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
            {/* Place order CTA at the top */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={placeOrderHandler}
                disabled={
                  Boolean(gatesReady && !marketplacePurchasingAllowed) ||
                  placing ||
                  step === "address" ||
                  (step === "payment" && !stripeAvailable)
                }
                className="w-full rounded-full bg-brand-gold py-3.5 text-base font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placing ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Placing…</span>
                ) : (
                  "Place your order"
                )}
              </button>
              <p className="text-center text-[11px] text-gray-500">
                By placing your order, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-foreground">terms</Link>.
              </p>
            </div>

            <div className="border-t border-gray-200" />

            <h2 className="text-lg font-bold text-foreground">Order Summary</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground">Items ({cartItems.reduce((n, i) => n + i.quantity, 0)}):</span>
                <span className="text-foreground">{formatCents(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground">Shipping &amp; handling:</span>
                <span className="text-foreground">{formatCents(displayShipping)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{formatCents(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-foreground">Total before tax:</span>
                <span className="text-foreground">{formatCents(displaySubtotal + displayShipping - totalDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground">Estimated tax to be collected:</span>
                <span className="text-foreground">{formatCents(displayTax)}</span>
              </div>
            </div>

            <div className="border-t border-gray-200" />

            <div className="flex items-end justify-between">
              <p className="text-lg font-bold text-red-700">Order total:</p>
              <p className="text-2xl font-bold text-red-700">{formatCents(displayTotal)}</p>
            </div>

            <div className="border-t border-gray-200" />

            {/* Gift card / promo code — collapsible link expands into the
                existing coupon UI. Wired to existing handlers. */}
            {couponsEnabled && (
              couponResult?.valid ? (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <span className="font-mono font-semibold text-green-700">{couponResult.code}</span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-medium text-gray-500 hover:text-foreground transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPromoOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-red-700 hover:text-red-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Add a gift card or promotion code
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        promoOpen ? "rotate-180" : "rotate-0",
                      )}
                    />
                  </button>
                  {promoOpen && (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Enter code"
                          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="px-4 py-2 rounded-lg bg-foreground text-white text-sm font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-50"
                        >
                          {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                        </button>
                      </div>
                      {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Trust microcopy — outside the card per image */}
          <div className="space-y-2 px-2">
            <div className="flex items-start gap-2 text-xs text-foreground/70">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-foreground">Secure transaction.</span>{" "}
                Your information is encrypted and protected.
              </p>
            </div>
            {/* Per-store return policy. Each store's exact policy is shown — no aggregation. */}
            {(() => {
              const storeIdsInCart = Array.from(new Set(cartItems.map((i) => i.storeId)))
              const rows = storeIdsInCart
                .map((id) => {
                  const policy = storeReturnPolicies[id]
                  const fallbackName = cartItems.find((i) => i.storeId === id)?.storeName ?? "Store"
                  const name = policy?.name ?? fallbackName
                  return { id, name, policy }
                })
                .filter((r) => r.policy)
              if (rows.length === 0) return null
              return rows.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-xs text-foreground/70">
                  <Package className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold text-foreground">{r.name}:</span>{" "}
                    {r.policy!.returnsSupported && r.policy!.returnWindowDays != null
                      ? `${r.policy!.returnWindowDays}-day return window`
                      : "Final sale (no returns)"}
                  </p>
                </div>
              ))
            })()}
          </div>
        </aside>
      </div>
    </main>
    </div>
  )
}
