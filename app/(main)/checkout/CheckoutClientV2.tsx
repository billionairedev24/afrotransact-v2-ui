"use client"

/**
 * CheckoutClientV2 — Amazon-style single-page sectioned checkout.
 *
 * Replaces the legacy step-machine flow in CheckoutClient.tsx. Selection
 * IS the commit (no "Continue / Use this address / Confirm payment method"
 * buttons). The right-rail "Place your order" CTA is the only action.
 *
 * Gated behind NEXT_PUBLIC_CHECKOUT_V2 in app/(main)/checkout/page.tsx.
 *
 * All API calls, Stripe wrapper, cart store, and helpers are reused from the
 * legacy implementation — nothing new was invented.
 *
 * NOTE: V2 inlines its own Stripe <Elements> + <PaymentElement> (see
 * `InlinePayment` below) and exposes `confirmPayment()` via
 * `useImperativeHandle`, so the right-rail "Place your order" CTA is the
 * single payment button. The legacy `_stripe-payment.tsx` remains untouched
 * and is still used by the legacy CheckoutClient.
 */

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react"
import { useRouter } from "next/navigation"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import {
  Loader2,
  Lock,
  MapPin,
  Truck,
  CreditCard,
  Package,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { friendlyMessage, logError } from "@/lib/errors"
import { features } from "@/lib/features"
import { useCartStore, clearGuestCart } from "@/stores/cart-store"
import { useCartHydration } from "@/components/providers/CartMergeProvider"
import { useBuyerLocation } from "@/stores/buyer-location"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"
import { PhoneInput, normalizeToE164 } from "@/components/ui/PhoneInput"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import { resolveDefaultRegion } from "@/lib/regions"
import { useEffectiveFeatures } from "@/hooks/use-effective-features"
import {
  checkout as apiCheckout,
  mergeCart,
  getRegions,
  getRegionConfig,
  loadCheckoutShippingContext,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  getShippingQuotes,
  listSavedPaymentMethods,
  validateCoupon,
  resolveServiceZone,
  ApiError,
  type CheckoutResponse,
  type CheckoutShippingContext,
  type Region,
  type RegionPaymentMethod,
  type SavedPaymentMethod,
  type ShippingQuoteOption,
  type ShippingQuoteResponse,
  type UserAddress,
  type ValidateCouponResponse,
  type ResolvedZone,
} from "@/lib/api"

// Module-local Stripe singleton. We don't reuse the one inside
// `_stripe-payment.tsx` because it isn't exported, and per the V2 brief we
// can't modify that file. Same publishable-key env var, so behavior matches.
let v2StripePromise: Promise<Stripe | null> | null = null
function getV2Stripe() {
  if (!v2StripePromise) {
    v2StripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder",
    )
  }
  return v2StripePromise
}

const V2_STRIPE_APPEARANCE = {
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
  },
}

export type PaymentHandle = {
  /** Returns true on success, false on user-facing failure (error already surfaced). */
  confirmPayment: () => Promise<boolean>
}

function formatCents(v: number) {
  return `$${(v / 100).toFixed(2)}`
}

type FlatQuote = ShippingQuoteOption & { carrier: string }

export default function CheckoutClientV2({
  initialContext,
}: {
  initialContext: CheckoutShippingContext | null
}) {
  const session = useSession()
  const router = useRouter()

  // ─── mount + auth gate ────────────────────────────────────────────
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [authToken, setAuthToken] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const t = await getAccessToken().catch(() => null)
      if (!cancelled) setAuthToken(t)
    })()
    return () => { cancelled = true }
  }, [])

  // ─── cart ──────────────────────────────────────────────────────────
  const cartItems = useCartStore((s) => s.items)
  const { cartReady } = useCartHydration()
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotal = getSubtotal()

  // Buyer's resolved service-location (post-regions rewrite). Preferred
  // over region for shipping quotes, coupon validation, and free-shipping
  // threshold. Region stays here as a soft fallback while the last
  // downstream services finish the cutover.
  const buyerResolvedZone = useBuyerLocation((s) => s.resolvedZone)
  const refreshResolvedZone = useBuyerLocation((s) => s.refreshResolvedZone)

  // Force a resolve refresh on checkout mount. Zustand-persist caches the
  // last zone shape; when server-side migrations change the effective
  // feature set (as happened when we moved to Service Locations), stale
  // caches make coupons_enabled / realtime shipping look "off" until the
  // buyer re-picks their location. Cheap idempotent GET fixes it.
  useEffect(() => {
    void refreshResolvedZone()
  }, [refreshResolvedZone])

  // ─── region + region config ───────────────────────────────────────
  const [region, setRegion] = useState<Region | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<RegionPaymentMethod[]>([])
  // configFeatures is now a legacy backstop for paymentMethods/threshold fetch;
  // the *authoritative* feature map comes from the Service Zones resolver via
  // useEffectiveFeatures below. We still call getRegionConfig for non-feature
  // data (payment methods, free-shipping threshold).
  const [configFeatures, setConfigFeatures] = useState<Record<string, boolean>>({})
  const { features: zoneOrRegionFeatures } = useEffectiveFeatures(region?.code ?? null)
  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    ;(async () => {
      try {
        const regions = await getRegions(authToken ?? undefined, true)
        if (cancelled) return
        const r = resolveDefaultRegion(regions.filter((x) => x.code))
        if (r) setRegion(r)
      } catch { /* fall back to defaults below */ }
    })()
    return () => { cancelled = true }
  }, [mounted, authToken])

  useEffect(() => {
    if (!region) return
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await getRegionConfig(region.code).catch(() => null)
        if (cancelled || !cfg) return
        setPaymentMethods(cfg.paymentMethods ?? [])
        setConfigFeatures(cfg.features ?? {})
      } catch { /* non-fatal */ }
    })()
    return () => { cancelled = true }
  }, [region])

  // ─── addresses (Section 1) ─────────────────────────────────────────
  const [addresses, setAddresses] = useState<UserAddress[]>(initialContext?.addresses ?? [])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
    const seed = initialContext?.addresses ?? []
    return (seed.find((a) => a.isDefault) ?? seed[0])?.id ?? null
  })
  const [addrModalOpen, setAddrModalOpen] = useState(false)
  const [addrEditingId, setAddrEditingId] = useState<string | null>(null)
  const [addrSaving, setAddrSaving] = useState(false)
  const sessionName = session?.data?.user?.name ?? ""
  const [profileName, setProfileName] = useState<string>(() => {
    const p = initialContext?.profile
    return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : ""
  })
  const [profilePhone, setProfilePhone] = useState<string>(initialContext?.profile?.phone ?? "")
  const [form, setForm] = useState({
    fullName: profileName || sessionName,
    line1: "", line2: "", city: "", state: "", zip: "", phone: profilePhone,
  })
  const [addressQuery, setAddressQuery] = useState("")
  const [makeDefault, setMakeDefault] = useState(false)

  // Fetch addresses if we weren't seeded
  useEffect(() => {
    if (initialContext || !authToken) return
    let cancelled = false
    ;(async () => {
      try {
        const ctx = await loadCheckoutShippingContext(authToken)
        if (cancelled) return
        setAddresses(ctx.addresses)
        const name = [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" ")
        setProfileName(name)
        setProfilePhone(ctx.profile.phone ?? "")
        setForm((f) => ({ ...f, fullName: name || sessionName || f.fullName, phone: ctx.profile.phone || f.phone }))
        const def = ctx.addresses.find((a) => a.isDefault) ?? ctx.addresses[0]
        if (def) setSelectedAddressId(def.id)
      } catch {
        toast.error("Could not load your saved addresses. Add a shipping address to continue.")
      }
    })()
    return () => { cancelled = true }
  }, [authToken, initialContext, sessionName])

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  // Resolve the SELECTED SHIPPING ADDRESS to a service zone. Shipping pricing,
  // the free-shipping threshold, and coupon eligibility are all zone-scoped and
  // must follow the destination the buyer ships to — NOT the geocoded browsing
  // location (buyerResolvedZone). Re-resolves whenever the selected address (or
  // its geography) changes, so switching address recomputes everything.
  const [addressZone, setAddressZone] = useState<ResolvedZone | null>(null)
  useEffect(() => {
    if (!selectedAddress) { setAddressZone(null); return }
    let cancelled = false
    resolveServiceZone(
      selectedAddress.countryCode || "US",
      selectedAddress.state ?? undefined,
      selectedAddress.postalCode ?? undefined,
      selectedAddress.city ?? undefined,
    )
      .then((z) => { if (!cancelled) setAddressZone(z) })
      .catch(() => { if (!cancelled) setAddressZone(null) })
    return () => { cancelled = true }
  }, [selectedAddress?.id, selectedAddress?.countryCode, selectedAddress?.state, selectedAddress?.postalCode, selectedAddress?.city])

  // Zone that drives all pricing + eligibility: the destination address's zone,
  // falling back to the geocoded location only until the address resolves.
  const activeZone = addressZone ?? buyerResolvedZone
  const activeZoneId = activeZone?.zone?.id

  function openNewAddress() {
    setAddrEditingId(null)
    setForm({ fullName: profileName || sessionName, line1: "", line2: "", city: "", state: "", zip: "", phone: normalizeToE164(profilePhone, "US") })
    setAddressQuery("")
    setMakeDefault(addresses.length === 0)
    setAddrModalOpen(true)
  }
  function openEditAddress(a: UserAddress) {
    setAddrEditingId(a.id)
    setForm({
      fullName: profileName || sessionName,
      line1: a.line1, line2: a.line2 ?? "",
      city: a.city, state: a.state ?? "",
      // Upgrade a legacy bare phone to E.164 using the address country so the
      // input shows +country and a plain re-save persists it correctly.
      zip: a.postalCode ?? "", phone: normalizeToE164(a.phone ?? profilePhone ?? "", a.countryCode || "US"),
    })
    setAddressQuery(a.line1)
    setMakeDefault(a.isDefault)
    setAddrModalOpen(true)
  }

  async function handleSaveAddress() {
    if (!authToken) { toast.error("Please sign in to save addresses."); return }
    if (!form.line1 || !form.city || !form.zip) return
    // Never store a bare phone — persist E.164 (with country code) or nothing.
    // A number that can't be validated for the country is rejected with a clear
    // message instead of being saved in a form checkout will later reject.
    const phoneE164 = normalizeToE164(form.phone ?? "", "US")
    if ((form.phone ?? "").trim() && !phoneE164) {
      toast.error("Enter a valid phone number including area code (e.g. +1 512 555 1234).")
      return
    }
    setAddrSaving(true)
    try {
      const basePayload = {
        label: "shipping",
        line1: form.line1.trim(),
        line2: form.line2?.trim() || undefined,
        city: form.city.trim(),
        state: form.state?.trim() || "",
        postalCode: form.zip.trim(),
        countryCode: "US",
        phone: phoneE164 || undefined,
      }
      const saved = addrEditingId
        ? await updateAddress(authToken, addrEditingId, basePayload)
        : await createAddress(authToken, { ...basePayload, isDefault: makeDefault || addresses.length === 0 })
      if (addrEditingId && makeDefault) {
        try { await setDefaultAddress(authToken, addrEditingId) } catch { /* non-fatal */ }
      }
      // Show the saved address immediately (optimistic). The server re-read
      // below can lag behind the write, which left the new address invisible
      // until a manual page refresh.
      setAddresses((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)])
      setSelectedAddressId(saved.id)
      setAddrModalOpen(false)
      // Background reconcile with the canonical server list, but keep `saved`
      // if the re-read hasn't caught up to it yet.
      try {
        const ctx = await loadCheckoutShippingContext(authToken)
        setAddresses(
          ctx.addresses.some((a) => a.id === saved.id) ? ctx.addresses : [saved, ...ctx.addresses],
        )
      } catch { /* keep the optimistic list */ }
    } catch (e) {
      logError(e, "saving address (v2)")
      toast.error(friendlyMessage(e, "Could not save address. Check required fields and try again."))
    } finally {
      setAddrSaving(false)
    }
  }

  async function handleDeleteAddress(id: string) {
    if (!authToken) return
    if (!confirm("Delete this address?")) return
    try {
      await deleteAddress(authToken, id)
    } catch (e) {
      // A 404 means the address is already gone server-side (e.g. a stale
      // list) — treat it as deleted and drop it from the UI anyway.
      if (!(e instanceof ApiError && e.status === 404)) {
        toast.error(friendlyMessage(e, "Could not delete that address."))
        return
      }
    }
    const next = addresses.filter((a) => a.id !== id)
    setAddresses(next)
    if (selectedAddressId === id) setSelectedAddressId(next[0]?.id ?? null)
  }

  // Push the client cart to the server so cart-dependent endpoints (shipping
  // quotes, checkout) see the current contents. The shipping-quote endpoint
  // reads the SERVER cart to weigh the order; without this it throws
  // "Cart is empty" and the UI shows "couldn't find shipping options".
  const syncServerCart = useCallback(async () => {
    if (!authToken) return
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
    await mergeCart(authToken, items)
  }, [authToken, cartItems])

  // ─── shipping quotes (Section 2) ───────────────────────────────────
  const [quotes, setQuotes] = useState<ShippingQuoteResponse | null>(null)
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"cheapest" | "fastest">("cheapest")
  const [ratesUnavailable, setRatesUnavailable] = useState(false)

  useEffect(() => {
    setQuotes(null)
    setQuotesError(null)
    setSelectedQuoteId(null)
    setRatesUnavailable(false)
    if (!authToken || !region || !selectedAddress) return
    let cancelled = false
    setQuotesLoading(true)
    ;(async () => {
      try {
        // Sync the cart to the server first — the quote endpoint weighs the
        // SERVER cart, so without this it sees an empty cart.
        await syncServerCart()
        // Backend expects EXACTLY one of zoneId / regionId (XOR). Prefer the
        // resolved service-zone id; only fall back to regionId if no zone
        // is resolved yet. Sending both fails validation with a 400.
        const zoneId = activeZoneId
        const q = await getShippingQuotes(authToken, {
          ...(zoneId ? { zoneId } : { regionId: region.id }),
          state: selectedAddress.state ?? "",
          city: selectedAddress.city,
          destinationLine1: selectedAddress.line1,
          destinationZip: selectedAddress.postalCode,
          destinationCountry: selectedAddress.countryCode || "US",
        })
        if (cancelled) return
        setQuotes(q)
        if ((q.groups ?? []).length === 0) setRatesUnavailable(true)
      } catch (e) {
        if (cancelled) return
        setQuotesError(friendlyMessage(e, "Couldn't get rates for this address. Try a different address?"))
        setRatesUnavailable(true)
      } finally {
        if (!cancelled) setQuotesLoading(false)
      }
    })()
    return () => { cancelled = true }
    // activeZoneId is included so the quote RE-FIRES once the destination zone
    // finishes resolving — otherwise a just-changed address quotes against the
    // previous address's zone and the shipping cost never updates.
  }, [authToken, region?.id, selectedAddress?.id, activeZoneId])  // eslint-disable-line react-hooks/exhaustive-deps

  const flatQuotes: FlatQuote[] = useMemo(() => {
    const out: FlatQuote[] = []
    for (const g of quotes?.groups ?? []) for (const o of g.options) out.push({ ...o, carrier: g.carrier })
    return out
  }, [quotes])

  const cheapestId = useMemo(() => {
    let id: string | null = null; let best = Infinity
    for (const o of flatQuotes) if (o.amountCents < best) { best = o.amountCents; id = o.quoteId }
    return id
  }, [flatQuotes])

  const sortedQuotes = useMemo(() => {
    const c = [...flatQuotes]
    if (sortBy === "cheapest") c.sort((a, b) => a.amountCents - b.amountCents || (a.estimatedDays ?? 99) - (b.estimatedDays ?? 99))
    else c.sort((a, b) => (a.estimatedDays ?? 99) - (b.estimatedDays ?? 99) || a.amountCents - b.amountCents)
    return c
  }, [flatQuotes, sortBy])

  // Group sorted quotes by carrier for render (preserving sort order of first
  // occurrence). Each group is tagged with whether it contains any synthetic
  // (platform) options and whether it is synthetic-only.
  const sortedGroups = useMemo(() => {
    const map = new Map<string, FlatQuote[]>()
    for (const q of sortedQuotes) {
      const arr = map.get(q.carrier) ?? []
      arr.push(q)
      map.set(q.carrier, arr)
    }
    return Array.from(map.entries()).map(([carrier, options]) => {
      const syntheticCount = options.filter((o) => o.quoteId?.startsWith("synthetic:")).length
      return {
        carrier,
        options,
        hasSynthetic: syntheticCount > 0,
        allSynthetic: syntheticCount === options.length,
      }
    })
  }, [sortedQuotes])
  const anySyntheticVisible = sortedGroups.some((g) => g.hasSynthetic)

  // preselect cheapest once
  useEffect(() => {
    if (!selectedQuoteId && cheapestId) setSelectedQuoteId(cheapestId)
  }, [cheapestId, selectedQuoteId])

  const selectedQuote = flatQuotes.find((q) => q.quoteId === selectedQuoteId) ?? null
  // Free shipping at/above the threshold overrides any quote: once the buyer has
  // unlocked free shipping we never charge the platform shipping fee. The
  // threshold is set on the buyer's resolved service zone (that's where
  // operators configure it); the region is a fallback. A threshold of 0 / null
  // means "not configured" — free shipping does NOT apply by threshold, so we
  // don't make everything free by accident.
  const freeShippingThresholdCents =
    activeZone?.effectiveSettings?.freeShippingThresholdCents ?? region?.freeShippingThresholdCents ?? 0
  const freeShippingApplies = freeShippingThresholdCents > 0 && subtotal >= freeShippingThresholdCents
  const shippingCents = freeShippingApplies ? 0 : (selectedQuote?.amountCents ?? 0)
  // A $0 shipping charge means free shipping (global switch or threshold met) —
  // show "Free" rather than "$0.00" everywhere shipping is displayed.
  const fmtShip = (cents: number) => (cents === 0 ? "Free" : formatCents(cents))

  // ─── re-quote shipping when the cart changes ──────────────────────
  // Debounce 400ms; cancel in-flight runs via a stale sentinel. We don't
  // re-quote on the initial mount path — the effect above handles first-load.
  const [requoting, setRequoting] = useState(false)
  const [requoteError, setRequoteError] = useState<string | null>(null)
  const requoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requoteRunIdRef = useRef(0)
  const didInitialQuoteRef = useRef(false)
  useEffect(() => {
    // Mark the first useful quotes-load completion so we only react to
    // *subsequent* cart changes.
    if (!didInitialQuoteRef.current && quotes && selectedQuoteId) {
      didInitialQuoteRef.current = true
    }
  }, [quotes, selectedQuoteId])

  useEffect(() => {
    if (!didInitialQuoteRef.current) return
    if (!authToken || !region || !selectedAddress) return
    if (cartItems.length === 0) return

    if (requoteTimerRef.current) clearTimeout(requoteTimerRef.current)
    requoteTimerRef.current = setTimeout(() => {
      const runId = ++requoteRunIdRef.current
      setRequoting(true)
      setRequoteError(null)
      setRatesUnavailable(false)
      ;(async () => {
        try {
          // Re-sync the (now-changed) cart before re-quoting.
          await syncServerCart()
          const zoneId = activeZoneId
          const q = await getShippingQuotes(authToken, {
            ...(zoneId ? { zoneId } : { regionId: region.id }),
            state: selectedAddress.state ?? "",
            city: selectedAddress.city,
            destinationLine1: selectedAddress.line1,
            destinationZip: selectedAddress.postalCode,
            destinationCountry: selectedAddress.countryCode || "US",
          })
          if (runId !== requoteRunIdRef.current) return // stale
          const next: FlatQuote[] = []
          for (const g of q.groups ?? []) for (const o of g.options) next.push({ ...o, carrier: g.carrier })
          const previousId = selectedQuoteId
          const stillThere = previousId && next.some((o) => o.quoteId === previousId)
          setQuotes(q)
          if (next.length === 0 && !stillThere) setRatesUnavailable(true)
          if (!stillThere) {
            let newCheapest: string | null = null
            let best = Infinity
            for (const o of next) if (o.amountCents < best) { best = o.amountCents; newCheapest = o.quoteId }
            if (newCheapest) {
              setSelectedQuoteId(newCheapest)
              toast.info("Delivery option updated to keep your order shippable.")
            }
          }
        } catch (e) {
          if (runId !== requoteRunIdRef.current) return
          setRequoteError(friendlyMessage(e, "Couldn't refresh delivery options. Please retry."))
          // Only mark unavailable if we have no prior valid selection to fall back to.
          if (!selectedQuoteId) setRatesUnavailable(true)
        } finally {
          if (runId === requoteRunIdRef.current) setRequoting(false)
        }
      })()
    }, 400)

    return () => {
      if (requoteTimerRef.current) clearTimeout(requoteTimerRef.current)
    }
    // We deliberately depend on cartItems (not items by ref): qty + composition.
    // activeZoneId included so a resolved zone change triggers a re-quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, authToken, region?.id, selectedAddress?.id, activeZoneId])

  // ─── saved cards (Section 3) ───────────────────────────────────────
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null)
  const [saveCard, setSaveCard] = useState(false)

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    listSavedPaymentMethods(authToken)
      .then((cards) => { if (!cancelled) setSavedCards(cards ?? []) })
      .catch(() => { /* no saved cards */ })
    return () => { cancelled = true }
  }, [authToken])

  // ─── coupons (region-gated) ────────────────────────────────────────
  // Prefer zone-resolved features; fall back to the legacy region config map.
  const effectiveFeatures =
    Object.keys(zoneOrRegionFeatures).length > 0 ? zoneOrRegionFeatures : configFeatures
  // "Global shipping" = realtime carrier shipping. When it's off we run a
  // courier-free delivery model, so the UI says "Delivery" rather than
  // "Shipping" (we don't hand parcels to a shipping provider). Prefer the
  // resolved quote flag; fall back to the effective feature map before quotes load.
  const globalShippingOn = quotes?.realtimeEnabled ?? Boolean(effectiveFeatures["realtime_shipping_enabled"])
  const shipNoun = globalShippingOn ? "Shipping" : "Delivery"
  const shipNounLower = globalShippingOn ? "shipping" : "delivery"
  // Coupons are zone-gated on the backend (`coupons_enabled` feature flag
  // resolved from the buyer's region → zone tree). Hide the input entirely
  // when the flag is off so buyers don't waste time entering a code just to
  // get "Coupons are not available in your region" back. Default to `true`
  // when the flag is missing so a broken feature fetch doesn't hide a
  // working coupon system.
  const couponsEnabled = effectiveFeatures["coupons_enabled"] !== false
  const [couponCode, setCouponCode] = useState("")
  const [couponInput, setCouponInput] = useState("")
  const [couponResult, setCouponResult] = useState<ValidateCouponResponse | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  const couponErrorMessage = useCallback((res: ValidateCouponResponse | null, fallback: string): string => {
    const raw = (res?.error ?? "").toLowerCase()
    if (raw.includes("expire")) return "This code has expired"
    if (raw.includes("minimum") || raw.includes("min ")) return "Minimum spend not met"
    if (!raw) return fallback
    return "That code isn’t valid"
  }, [])

  const runValidateCoupon = useCallback(async (code: string): Promise<ValidateCouponResponse | null> => {
    if (!authToken) return null
    // Pass shippingCents so a shipping-target coupon can compute its discount
    // against the actual quoted shipping fee. Prefer the resolved service-zone
    // id (that's where coupons_enabled is configured); region.id stays as the
    // legacy fallback — same XOR-preference the shipping-quote call uses.
    const zoneId = activeZoneId
    return await validateCoupon(authToken, code, subtotal, region?.id, shippingCents, zoneId)
  }, [authToken, subtotal, region?.id, shippingCents, activeZoneId])

  async function handleApplyCoupon() {
    if (!couponsEnabled || !couponInput.trim() || !authToken) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await runValidateCoupon(couponInput.trim())
      if (res?.valid) {
        setCouponResult(res)
        setCouponCode(couponInput.trim())
        setCouponInput("")
      } else {
        setCouponError(couponErrorMessage(res, "That code isn’t valid"))
      }
    } catch (e) {
      logError(e, "validate coupon (v2)")
      setCouponError(friendlyMessage(e, "Could not validate coupon"))
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setCouponResult(null)
    setCouponCode("")
    setCouponError(null)
  }

  // Re-validate the applied coupon whenever the cart changes (min-spend may now
  // fail) OR the destination address's zone changes (coupons_enabled and any
  // shipping-target discount are zone-scoped, so a coupon valid in one zone may
  // not apply in another — clear it if it no longer holds).
  useEffect(() => {
    if (!couponResult || !couponCode || !authToken) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await runValidateCoupon(couponCode)
        if (cancelled) return
        if (res?.valid) {
          setCouponResult(res)
        } else {
          setCouponResult(null)
          setCouponError(couponErrorMessage(res, "Coupon no longer applies"))
        }
      } catch (e) {
        logError(e, "revalidate coupon (v2)")
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, cartItems.length, region?.id, activeZoneId])

  // ─── totals ────────────────────────────────────────────────────────
  // Tax comes from the resolved destination zone — the same source the server
  // charges from (resolveZoneByAddress). region.taxRate is the LEGACY source
  // and can diverge (e.g. still 8.25% after a zone is set to 0), so we never
  // use it here. Unconfigured zone → 0, matching the server.
  const taxRate = activeZone?.effectiveSettings?.taxRate ?? 0
  const discountCents = couponResult?.discountCents ?? 0
  const couponTargetsShipping = couponResult?.discountTarget === "shipping"
  // Shipping-target coupons reduce shipping (never below 0); items-target
  // coupons reduce the taxable subtotal. Backend applies the same split.
  const itemsDiscountCents = couponTargetsShipping ? 0 : discountCents
  const shippingDiscountCents = couponTargetsShipping
    ? Math.min(discountCents, shippingCents)
    : 0
  const taxableSubtotal = Math.max(0, subtotal - itemsDiscountCents)
  const tax = Math.round(taxableSubtotal * taxRate)
  const effectiveShippingCents = Math.max(0, shippingCents - shippingDiscountCents)
  const total = taxableSubtotal + tax + effectiveShippingCents

  const stripeFeatureEnabled = features.stripeEnabled()
  const stripeRow = paymentMethods.find((m) => m.provider.toLowerCase() === "stripe")
  const stripeMethodEnabled = stripeRow ? stripeRow.enabled : paymentMethods.length === 0
  const stripeAvailable = stripeFeatureEnabled && stripeMethodEnabled

  // ─── mint PaymentIntent when address+rate ready ───────────────────
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null)
  const [minting, setMinting] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const placingRef = useRef(false)

  // Reset the PI whenever the inputs that determine its amount change.
  useEffect(() => {
    idempotencyKeyRef.current = null
    setCheckoutResult(null)
  }, [selectedAddressId, selectedQuoteId, subtotal, region?.id, saveCard, couponCode, discountCents])

  const mintIntent = useCallback(async () => {
    if (placingRef.current) return null
    if (!authToken || !region || !selectedAddress) return null
    if (checkoutResult) return checkoutResult
    placingRef.current = true
    setMinting(true)
    setPlaceError(null)
    try {
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
      await mergeCart(authToken, items)
      // Normalize the address phone to E.164 (respecting the address country)
      // so a legacy bare number doesn't fail the order service. Block with a
      // clear message when a stored number can't be validated for its country.
      const rawPhone = selectedAddress.phone ?? profilePhone ?? ""
      const phoneE164 = normalizeToE164(rawPhone, selectedAddress.countryCode || "US")
      if (rawPhone.trim() && !phoneE164) {
        setPlaceError("The phone number on this address isn't valid for its country. Edit the address and re-enter your phone number.")
        return null
      }
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
      const result = await apiCheckout(authToken, {
        regionId: region.id,
        shippingAddressId: selectedAddress.id,
        fullName: profileName || sessionName,
        line1: selectedAddress.line1,
        line2: selectedAddress.line2 ?? undefined,
        city: selectedAddress.city,
        state: selectedAddress.state ?? "",
        zip: selectedAddress.postalCode ?? "",
        phone: phoneE164 || undefined,
        saveAddress: false,
        // When free shipping applies we don't assert a paid carrier quote — the
        // order service bills $0 shipping above the threshold, and this keeps the
        // charge in agreement with what the buyer sees.
        selectedShippingQuoteId: freeShippingApplies ? undefined : selectedQuote?.quoteId,
        selectedShippingCarrier: freeShippingApplies ? undefined : selectedQuote?.carrier,
        selectedShippingService: freeShippingApplies ? undefined : selectedQuote?.serviceCode,
        selectedShippingAmountCents: shippingCents,
        saveCard,
        couponCodes: couponResult && couponCode ? [couponCode] : undefined,
      }, idempotencyKeyRef.current)
      setCheckoutResult(result)
      return result
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/auth/login?callbackUrl=/checkout")
        return null
      }
      logError(e, "checkout (v2)")
      setPlaceError(friendlyMessage(e, "Checkout failed. Please try again."))
      return null
    } finally {
      placingRef.current = false
      setMinting(false)
    }
  }, [authToken, region, selectedAddress, cartItems, checkoutResult, selectedQuote, saveCard, profileName, profilePhone, sessionName, router])

  // ─── place order ───────────────────────────────────────────────────
  const paymentHandleRef = useRef<PaymentHandle | null>(null)
  const [paying, setPaying] = useState(false)

  const handlePaymentComplete = useCallback(async () => {
    // Server cart is cleared by PaymentEventConsumer once session.converted
    // fires and the order materializes. Deleting it here caused a race:
    // any lingering checkout request (mount effect, retry) would hit an
    // already-empty cart and fail with 400.
    clearCart()
    try { clearGuestCart() } catch { /* non-fatal */ }
    const sid = checkoutResult?.checkoutSessionId
    router.push(sid ? `/checkout/complete?session=${encodeURIComponent(sid)}` : "/checkout/complete")
  }, [clearCart, router, checkoutResult])

  // Pre-mint the PI as soon as we have an address + rate, so clientSecret is
  // ready by the time the buyer scrolls to payment. mintIntent is idempotent
  // for a fixed input set (idempotencyKeyRef + early-return on checkoutResult).
  useEffect(() => {
    if (!authToken || !region || !selectedAddress || !selectedQuoteId) return
    if (checkoutResult) return
    void mintIntent()
  }, [authToken, region, selectedAddress, selectedQuoteId, checkoutResult, mintIntent])

  async function handlePlaceOrder() {
    setPlaceError(null)
    let result = checkoutResult
    if (!result) result = await mintIntent()
    if (!result) return
    const handle = paymentHandleRef.current
    if (!handle) {
      setPlaceError("Payment isn't ready yet. Please wait a moment and try again.")
      return
    }
    setPaying(true)
    try {
      const ok = await handle.confirmPayment()
      if (ok) await handlePaymentComplete()
    } finally {
      setPaying(false)
    }
  }

  // ─── disabled reason for Place Order ──────────────────────────────
  let disabledReason: string | null = null
  if (cartItems.length === 0) disabledReason = "Your cart is empty"
  else if (!selectedAddress) disabledReason = `Select a ${shipNounLower} address`
  else if (ratesUnavailable) disabledReason = "Shipping isn't available for this address yet"
  else if (!selectedQuoteId) disabledReason = "Choose a delivery option"
  else if (!stripeAvailable) disabledReason = "Payment is unavailable in this region"
  else if (selectedSavedCardId === null && !checkoutResult && !minting) disabledReason = null // new-card path: minting on click
  if (requoting) disabledReason = "Updating delivery options…"
  const placeDisabled = disabledReason !== null || minting || placingRef.current || paying || requoting || ratesUnavailable

  // ─── empty cart guard ─────────────────────────────────────────────
  useEffect(() => {
    // The cart is server-only, so on a fresh load/refresh `cartItems` is []
    // for a moment until getCart() lands. Wait for the cart to actually
    // hydrate (cartReady) before treating an empty cart as real — otherwise a
    // checkout refresh redirects to /cart on the transient empty state.
    if (!mounted || !cartReady) return
    // Also bail while a payment is in-flight: handlePaymentComplete() calls
    // clearCart() *before* router.push('/checkout/complete'), and without this
    // guard the resulting empty-cart transition races the push and lands the
    // buyer on /cart instead of the acknowledgement page.
    if (paying || placingRef.current) return
    if (cartItems.length === 0) router.replace("/cart")
  }, [mounted, cartReady, cartItems.length, router, paying])

  if (!mounted) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="h-32 flex items-center justify-center text-gray-500">Loading…</div>
      </main>
    )
  }

  if (session?.status === "unauthenticated") {
    router.replace("/auth/login?callbackUrl=/checkout")
    return null
  }

  // ─── render ────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 pb-32 lg:pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sections column */}
        <div className="lg:col-span-2 space-y-4">

          {/* 1. Shipping address */}
          <Section
            n={1}
            title={`${shipNoun} address`}
            subtitle={selectedAddress
              ? `${selectedAddress.line1}, ${selectedAddress.city}, ${selectedAddress.state} ${selectedAddress.postalCode}`
              : "Choose where to deliver"}
          >
            {addresses.length === 0 ? (
              <p className="text-sm text-gray-500 mb-3">No saved addresses yet.</p>
            ) : (
              <ul className="space-y-2">
                {addresses.map((a) => {
                  const checked = selectedAddressId === a.id
                  return (
                    <li key={a.id}>
                      <label className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors",
                        checked ? "border-brand-gold bg-amber-50/40" : "border-gray-200 hover:bg-gray-50",
                      )}>
                        <input
                          type="radio"
                          name="ship-addr"
                          checked={checked}
                          onChange={() => setSelectedAddressId(a.id)}
                          className="mt-1 h-4 w-4 accent-brand-gold"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{profileName || sessionName || "Address"}</p>
                            {a.isDefault && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 leading-snug">
                            {a.line1}{a.line2 ? `, ${a.line2}` : ""}
                          </p>
                          <p className="text-sm text-gray-500">
                            {a.city}, {a.state} {a.postalCode}
                          </p>
                          {a.phone && <p className="text-xs text-gray-500 mt-1">{a.phone}</p>}
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); openEditAddress(a) }}
                              className="text-xs font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                            >
                              <Edit2 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); handleDeleteAddress(a.id) }}
                              className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={openNewAddress}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-gold-foreground hover:underline"
            >
              <Plus className="h-4 w-4" /> Add a new address
            </button>
          </Section>

          {/* 2. Delivery options */}
          <Section
            n={2}
            title="Delivery options"
            subtitle={freeShippingApplies
              ? "Free — your order qualifies for free delivery"
              : selectedQuote
                ? `${selectedQuote.serviceName} — ${fmtShip(selectedQuote.amountCents)}`
                : "Choose a delivery option"}
            disabled={!selectedAddress}
          >
            {requoting && (
              <p className="text-xs text-muted-foreground text-right mb-2">Updating delivery options…</p>
            )}
            {requoteError && !requoting && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {requoteError}
              </div>
            )}
            {!selectedAddress ? (
              <p className="text-sm text-gray-500">Select a {shipNounLower} address to see options.</p>
            ) : quotesLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Getting rates…
              </div>
            ) : ratesUnavailable ? (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-semibold text-amber-900">We couldn&apos;t find shipping options for this address.</p>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  This can happen when a seller doesn&apos;t ship to your area, an address can&apos;t be verified, or our carriers
                  are temporarily unreachable.
                </p>
                <ul className="mt-3 space-y-1 text-amber-900">
                  <li>• Try a different {shipNounLower} address above.</li>
                  <li>• Or contact us and we&apos;ll help you place the order manually.</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href="/help"
                    className="inline-flex items-center justify-center rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950"
                  >
                    Contact support
                  </a>
                  <a
                    href="mailto:support@afrotransact.com"
                    className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                  >
                    support@afrotransact.com
                  </a>
                </div>
              </div>
            ) : quotesError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {quotesError}
              </div>
            ) : flatQuotes.length === 0 ? (
              <p className="text-sm text-gray-500">No delivery options available for this address.</p>
            ) : (
              <>
                {/* Amazon-style flat ranked list. Carrier brand (USPS/UPS/
                    FedEx) is intentionally hidden — the buyer chooses by
                    speed and price; the carrier is a backstage detail. */}
                <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {sortedQuotes.map((q) => {
                    const checked = selectedQuoteId === q.quoteId
                    return (
                      <li key={q.quoteId}>
                        <label className={cn(
                          "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                          checked ? "bg-amber-50/40" : "hover:bg-gray-50",
                        )}>
                          <input
                            type="radio"
                            name="ship-rate"
                            checked={checked}
                            onChange={() => setSelectedQuoteId(q.quoteId)}
                            className="h-4 w-4 accent-brand-gold"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {q.serviceName}
                            </p>
                            {/* Delivery ETA is a flat 24h placeholder until we
                                model real speed by location/carrier. */}
                            <p className="text-xs text-gray-500">
                              Arrives in 24 hours
                            </p>
                          </div>
                          {/* Once the free-delivery threshold is met we never
                              show a price — the carrier fee is waived. */}
                          {freeShippingApplies ? (
                            <p className="text-sm font-bold text-green-700 tabular-nums">Free</p>
                          ) : (
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtShip(q.amountCents)}</p>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Section>

          {/* 3. Payment method */}
          <Section
            n={3}
            title="Payment method"
            subtitle={selectedSavedCardId
              ? `Saved card •••• ${savedCards.find((c) => c.stripePmId === selectedSavedCardId)?.last4 ?? "????"}`
              : "Use a new card"}
            disabled={!selectedAddress || !selectedQuoteId}
          >
            {(!selectedAddress || !selectedQuoteId) ? (
              <p className="text-sm text-gray-500">Select an address and delivery option above.</p>
            ) : !stripeAvailable ? (
              <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                Card payments via Stripe are not available in this region yet.
              </div>
            ) : (
              <InlinePayment
                ref={paymentHandleRef}
                clientSecret={checkoutResult?.paymentClientSecret ?? null}
                checkoutSessionId={checkoutResult?.checkoutSessionId ?? null}
                totalCents={total}
                saveCard={saveCard}
                onSaveCardChange={setSaveCard}
                savedCards={savedCards}
                selectedSavedCardId={selectedSavedCardId}
                onSelectedSavedCardChange={setSelectedSavedCardId}
                onError={setPlaceError}
              />
            )}
          </Section>

          {/* 4. Review items */}
          <Section
            n={4}
            title="Review items"
            subtitle={`${cartItems.length} item${cartItems.length === 1 ? "" : "s"} in your order`}
          >
            <ul className="divide-y divide-gray-100">
              {cartItems.map((it) => (
                <li key={it.variantId} className="flex gap-3 py-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {it.imageUrl ? (
                      <Image src={it.imageUrl} alt={it.title} fill className="object-cover" sizes="64px" unoptimized />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-gray-400 text-xs">No image</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{it.title}</p>
                    <p className="text-xs text-gray-500">
                      {it.storeName && it.storeName !== it.storeId ? it.storeName : null}
                      {it.storeName && it.storeName !== it.storeId && it.variantName ? " • " : null}
                      {it.variantName || null}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(it.variantId, Math.max(0, it.quantity - 1))}
                        className="h-7 w-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                        aria-label="Decrease quantity"
                      >−</button>
                      <span className="text-sm font-semibold tabular-nums w-6 text-center">{it.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(it.variantId, it.quantity + 1)}
                        className="h-7 w-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                        aria-label="Increase quantity"
                      >+</button>
                      <button
                        type="button"
                        onClick={() => removeItem(it.variantId)}
                        className="ml-2 text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCents(it.price * it.quantity)}</p>
                    <p className="text-xs text-gray-500 tabular-nums">{formatCents(it.price)} ea</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/cart" className="mt-3 inline-block text-sm font-semibold text-brand-gold-foreground hover:underline">
              Edit cart
            </Link>
          </Section>

        </div>

        {/* Right rail: Order summary */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Order summary</h2>

            {couponsEnabled && (
              <div className="mb-3 text-sm">
                {couponResult ? (
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <span className="text-green-800">
                      Code <span className="font-mono font-semibold">{couponResult.code}</span> applied
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">Promo code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-brand-gold-foreground disabled:opacity-50"
                      >
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                  </div>
                )}
              </div>
            )}

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Items ({cartItems.length})</dt>
                <dd className="text-gray-900 tabular-nums">{formatCents(subtotal)}</dd>
              </div>
              {couponResult && discountCents > 0 && !couponTargetsShipping && (
                <div className="flex justify-between italic text-green-700">
                  <dt>Discount ({couponResult.code})</dt>
                  <dd className="tabular-nums">-{formatCents(discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  {shipNoun}
                  {/* The badge must reflect what we actually charge — never
                      contradict the line total. Show "free" when the buyer has
                      met the free-shipping threshold or the quote is genuinely $0. */}
                  {effectiveShippingCents === 0 && (freeShippingApplies || selectedQuote) && !couponTargetsShipping && (
                    <span className="ml-2 text-[11px] font-semibold text-green-700">Free {shipNounLower} applied</span>
                  )}
                  {couponTargetsShipping && shippingDiscountCents > 0 && (
                    <span className="ml-2 text-[11px] font-semibold text-green-700">
                      {effectiveShippingCents === 0 ? "Waived" : "Discounted"} by {couponResult?.code}
                    </span>
                  )}
                </dt>
                <dd className="text-gray-900 tabular-nums">
                  {freeShippingApplies || selectedQuote ? (
                    couponTargetsShipping && shippingDiscountCents > 0 ? (
                      <>
                        <span className="text-gray-400 line-through mr-1">{fmtShip(shippingCents)}</span>
                        {fmtShip(effectiveShippingCents)}
                      </>
                    ) : (
                      fmtShip(shippingCents)
                    )
                  ) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Tax</dt>
                {taxRate === 0 ? (
                  <dd className="font-medium text-green-600">No tax</dd>
                ) : (
                  <dd className="text-gray-900 tabular-nums">{formatCents(tax)}</dd>
                )}
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                <dt className="text-base font-bold text-gray-900">Order total</dt>
                <dd className="text-base font-bold text-gray-900 tabular-nums">{formatCents(total)}</dd>
              </div>
            </dl>

            {placeError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3 w-3 inline mr-1" /> {placeError}
              </div>
            )}

            <PlaceOrderButton
              disabled={placeDisabled}
              loading={minting || paying}
              disabledReason={disabledReason}
              onClick={handlePlaceOrder}
              className="hidden lg:flex mt-4 w-full"
            />

            <p className="mt-3 text-[11px] text-gray-500 text-center">
              By placing your order, you agree to AfroTransact&apos;s{" "}
              <a href="/terms" className="underline">Terms</a> and{" "}
              <a href="/privacy" className="underline">Privacy Policy</a>.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Order total</p>
            <p className="text-base font-bold text-gray-900 tabular-nums">{formatCents(total)}</p>
          </div>
          <PlaceOrderButton
            disabled={placeDisabled}
            loading={minting}
            disabledReason={disabledReason}
            onClick={handlePlaceOrder}
            className="flex-1"
          />
        </div>
      </div>

      {/* Address modal */}
      {addrModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAddrModalOpen(false) }}
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{addrEditingId ? "Edit address" : "Add a new address"}</h3>
              <button type="button" onClick={() => setAddrModalOpen(false)} className="text-gray-400 hover:text-gray-900">×</button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                <PhoneInput value={form.phone} onChange={(e164) => setForm({ ...form, phone: e164 })} defaultCountry="US" className="w-full" />
                <p className="mt-1 text-[11px] text-gray-500">Include your country and area code — used for delivery updates.</p>
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
              <Field label="Apt, suite, unit (optional)" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
              </div>
              <Field label="ZIP code" value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} inputMode="numeric" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-brand-gold" />
                Set as my default address
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setAddrModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-200">Cancel</button>
              <button
                type="button"
                onClick={handleSaveAddress}
                disabled={!form.fullName || !form.line1 || !form.city || !form.zip || addrSaving}
                className="px-4 py-2 rounded-lg bg-brand-gold text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover disabled:opacity-40 inline-flex items-center gap-2"
              >
                {addrSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/* ── Building blocks ─────────────────────────────────────────────── */

function Section({
  n, title, subtitle, disabled, children,
}: {
  n: number
  title: string
  subtitle?: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={cn(
      "rounded-xl border border-gray-200 bg-white shadow-sm",
      disabled && "opacity-70",
    )}>
      <header className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-gray-900 text-white text-sm font-bold">{n}</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({
  label, value, onChange, inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputMode?: "numeric" | "tel" | "email" | "text" | "decimal" | "search" | "url" | "none"
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10 transition-all"
      />
    </div>
  )
}

function PlaceOrderButton({
  disabled, loading, disabledReason, onClick, className,
}: {
  disabled: boolean
  loading: boolean
  disabledReason: string | null
  onClick: () => void
  className?: string
}) {
  const describedById = "place-order-reason"
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        aria-describedby={disabledReason ? describedById : undefined}
        title={disabledReason ?? undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 px-4 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Placing order…</>
        ) : (
          <><Lock className="h-3.5 w-3.5" /> Place your order</>
        )}
      </button>
      {disabledReason && (
        <span id={describedById} className="sr-only">{disabledReason}</span>
      )}
    </>
  )
}

/* ── Inline Stripe payment (replaces the embedded PaymentStep) ───── */

type InlinePaymentProps = {
  clientSecret: string | null
  checkoutSessionId: string | null
  totalCents: number
  saveCard: boolean
  onSaveCardChange: (next: boolean) => void
  savedCards: SavedPaymentMethod[]
  selectedSavedCardId: string | null
  onSelectedSavedCardChange: (id: string | null) => void
  onError: (msg: string | null) => void
}

const InlinePayment = forwardRef<PaymentHandle, InlinePaymentProps>(function InlinePayment(
  props,
  ref,
) {
  const { clientSecret, totalCents, saveCard } = props
  return (
    // `key` forces a full remount when the PaymentIntent or save-card option
    // changes, mirroring the legacy PaymentStep's behavior to avoid stale
    // PaymentIntent references in Stripe Elements.
    <Elements
      key={`${clientSecret ?? "no-pi"}|${saveCard ? "sfu" : "no-sfu"}`}
      stripe={getV2Stripe()}
      options={{
        mode: "payment",
        amount: Math.max(totalCents, 50),
        currency: "usd",
        appearance: V2_STRIPE_APPEARANCE,
        paymentMethodCreation: "manual",
        ...(saveCard ? { setupFutureUsage: "off_session" as const } : {}),
      }}
    >
      <InlinePaymentForm {...props} handleRef={ref} />
    </Elements>
  )
})

function InlinePaymentForm({
  clientSecret,
  checkoutSessionId,
  saveCard,
  onSaveCardChange,
  savedCards,
  selectedSavedCardId,
  onSelectedSavedCardChange,
  onError,
  handleRef,
}: InlinePaymentProps & { handleRef: React.ForwardedRef<PaymentHandle> }) {
  const stripe = useStripe()
  const elements = useElements()

  const usingSaved = selectedSavedCardId !== null

  useImperativeHandle(handleRef, () => ({
    async confirmPayment() {
      onError(null)
      if (!stripe) {
        onError("Payment isn't ready yet. Please wait a moment and try again.")
        return false
      }
      if (!clientSecret) {
        onError("Payment could not be initialized. Please try again or contact support.")
        return false
      }

      if (usingSaved && selectedSavedCardId) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: selectedSavedCardId },
        )
        if (confirmError) {
          onError(confirmError.message ?? "Payment failed. Please try again.")
          return false
        }
        return true
      }

      if (!elements) {
        onError("Payment form not ready. Please wait a moment.")
        return false
      }

      const { error: submitError } = await elements.submit()
      if (submitError) {
        onError(submitError.message ?? "Payment validation failed.")
        return false
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: checkoutSessionId
            ? `${window.location.origin}/checkout/complete?session=${encodeURIComponent(checkoutSessionId)}`
            : `${window.location.origin}/checkout/complete`,
        },
        redirect: "if_required",
      })

      if (confirmError) {
        onError(confirmError.message ?? "Payment failed. Please try again.")
        return false
      }
      return true
    },
  }), [stripe, elements, clientSecret, checkoutSessionId, usingSaved, selectedSavedCardId, onError])

  // Track the currently-selected payment-method type from Stripe's PaymentElement
  // so the "save for next time" checkbox can name the right thing (card / bank
  // account / Apple Pay, etc.) instead of hardcoding "card".
  const [pmType, setPmType] = useState<string>("card")
  const saveLabel = (() => {
    switch (pmType) {
      case "card":            return "Save this card for next time"
      case "us_bank_account": return "Save this bank account for next time"
      case "sepa_debit":      return "Save this bank account for next time"
      case "link":            return "Save this Link account for next time"
      default:                return "Save this payment method for next time"
    }
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>Secure checkout</span>
      </div>

      {savedCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Saved payment methods</p>
          {savedCards.map((card) => {
            const checked = selectedSavedCardId === card.stripePmId
            const brand = (card.brand ?? "card").toLowerCase()
            const brandLabel = brand.charAt(0).toUpperCase() + brand.slice(1)
            return (
              <label
                key={card.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border bg-white p-4 cursor-pointer transition-all",
                  checked
                    ? "border-brand-gold ring-2 ring-brand-gold/30 shadow-sm"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <input
                  type="radio"
                  name="v2-saved-card"
                  checked={checked}
                  onChange={() => onSelectedSavedCardChange(card.stripePmId)}
                  className="h-4 w-4 accent-brand-gold shrink-0"
                />
                <div className="flex h-9 w-14 items-center justify-center rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 shrink-0">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{brandLabel}</span>
                    <span className="text-sm text-gray-700 font-mono tabular-nums">ending in {card.last4 ?? "····"}</span>
                    {card.isDefault && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Default
                      </span>
                    )}
                  </div>
                  {card.expMonth && card.expYear && (
                    <p className="mt-0.5 text-xs text-gray-500 tabular-nums">
                      Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                    </p>
                  )}
                </div>
              </label>
            )
          })}
          <label
            className={cn(
              "flex items-center gap-4 rounded-xl border border-dashed bg-white p-4 cursor-pointer transition-all",
              selectedSavedCardId === null
                ? "border-brand-gold ring-2 ring-brand-gold/30"
                : "border-gray-300 hover:border-gray-400",
            )}
          >
            <input
              type="radio"
              name="v2-saved-card"
              checked={selectedSavedCardId === null}
              onChange={() => onSelectedSavedCardChange(null)}
              className="h-4 w-4 accent-brand-gold shrink-0"
            />
            <div className="flex h-9 w-14 items-center justify-center rounded-md border border-gray-200 bg-gray-50 shrink-0">
              <Plus className="h-4 w-4 text-gray-500" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Use a new payment method</span>
          </label>
        </div>
      )}

      {!usingSaved && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <PaymentElement
            options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }}
            onChange={(e) => { if (e.value?.type) setPmType(e.value.type) }}
          />
          <label className="mt-4 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => onSaveCardChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
            />
            <span className="text-sm text-foreground">{saveLabel}</span>
          </label>
        </div>
      )}
    </div>
  )
}
