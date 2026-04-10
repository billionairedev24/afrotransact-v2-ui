"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  Store,
  Save,
  MapPin,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
} from "lucide-react"
import {
  getCurrentSeller,
  getSellerStores,
  createStore,
  updateStore,
  getAdminShippingSettings,
  getRegionConfig,
  type StoreDetail,
} from "@/lib/api"
import { useSellerMe, useSellerStores } from "@/hooks/use-seller-stats"
import { useQueryClient } from "@tanstack/react-query"
import { useUploadThing } from "@/lib/uploadthing"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"

const inputClass =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
const textareaClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"

type FormData = {
  name: string
  description: string
  addressLine1: string
  addressCity: string
  addressState: string
  addressZip: string
  addressCountry: string
  deliveryRadiusMiles: string
  shipFromSameAsBusiness: boolean
  shipFromLine1: string
  shipFromCity: string
  shipFromState: string
  shipFromZip: string
  shipFromCountry: string
  allowedCarriers: string[]
  logoUrl: string
  bannerUrl: string
}

function storeToForm(store: any): FormData {
  if (!store) {
    return {
      name: "",
      description: "",
      addressLine1: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
      addressCountry: "US",
      deliveryRadiusMiles: "10",
      shipFromSameAsBusiness: true,
      shipFromLine1: "",
      shipFromCity: "",
      shipFromState: "",
      shipFromZip: "",
      shipFromCountry: "US",
      allowedCarriers: ["usps", "ups", "fedex"],
      logoUrl: "",
      bannerUrl: "",
    }
  }
  return {
    name: store.name,
    description: store.description ?? "",
    addressLine1: store.addressLine1 ?? "",
    addressCity: store.addressCity ?? "",
    addressState: store.addressState ?? "",
    addressZip: store.addressZip ?? "",
    addressCountry: store.addressCountry ?? "US",
    deliveryRadiusMiles: String(store.deliveryRadiusMiles ?? 10),
    shipFromSameAsBusiness: store.shipFromSameAsBusiness ?? true,
    shipFromLine1: store.shipFromLine1 ?? "",
    shipFromCity: store.shipFromCity ?? "",
    shipFromState: store.shipFromState ?? "",
    shipFromZip: store.shipFromZip ?? "",
    shipFromCountry: store.shipFromCountry ?? "US",
    allowedCarriers: store.allowedCarriers ?? ["usps", "ups", "fedex"],
    logoUrl: store.logoUrl ?? "",
    bannerUrl: store.bannerUrl ?? "",
  }
}

function isShipFromCompleteForCarrier(data: FormData): boolean {
  if (data.shipFromSameAsBusiness) {
    return Boolean(
      data.addressLine1?.trim() &&
        data.addressCity?.trim() &&
        data.addressState?.trim() &&
        data.addressZip?.trim(),
    )
  }
  return Boolean(
    data.shipFromLine1?.trim() &&
      data.shipFromCity?.trim() &&
      data.shipFromState?.trim() &&
      data.shipFromZip?.trim(),
  )
}

function validateForm(data: FormData, carrierShippingEnabled: boolean): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data.name.trim()) errors.push("Store name is required")
  if (data.name.length > 100) errors.push("Store name must be 100 characters or less")
  if (data.description.length > 500) errors.push("Description must be 500 characters or less")
  const radius = parseInt(data.deliveryRadiusMiles, 10)
  if (isNaN(radius) || radius < 1 || radius > 100) errors.push("Delivery radius must be between 1 and 100 miles")
  if (carrierShippingEnabled && !isShipFromCompleteForCarrier(data)) {
    errors.push(
      "Carrier shipping is enabled for the platform: complete your ship-from address (or match it to your business address with a full business address).",
    )
  }
  // Logo and banner URLs come from UploadThing — no manual URL validation needed
  return { valid: errors.length === 0, errors }
}

function ImageUploadField({
  label, hint, currentUrl, onUploaded, onRemove, aspect, endpoint,
}: {
  label: string; hint: string; currentUrl: string
  onUploaded: (url: string) => void; onRemove: () => void
  aspect: "square" | "wide"
  endpoint: "storeLogo" | "storeBanner"
}) {
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        const uploaded = res[0]
        const url = (uploaded as unknown as Record<string, string>).ufsUrl
          || uploaded.url
          || (uploaded.key ? `https://utfs.io/f/${uploaded.key}` : "")
        onUploaded(url)
      }
    },
    onUploadError: (err) => {
      setUploadError(err.message || "Upload failed")
    },
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { setUploadError("Please select an image file"); return }
    setUploadError(null)
    await startUpload([file])
    e.target.value = ""
  }

  const previewClass = aspect === "square" ? "h-24 w-24 rounded-lg" : "h-24 w-48 rounded-lg"

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-start gap-4">
        {currentUrl ? (
          <div className="relative group">
            <img src={currentUrl} alt={label} className={`${previewClass} object-cover border border-border`} />
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className={`${previewClass} border-2 border-dashed border-border flex items-center justify-center`}>
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? "Uploading…" : "Upload image"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="sr-only" disabled={isUploading} />
          </label>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </div>
      </div>
    </div>
  )
}

export default function StoreSettingsPage() {
  const { status: sessionStatus } = useSession()
  const queryClient = useQueryClient()
  const { data: seller, isLoading: sellerLoading } = useSellerMe()
  const { data: stores = [], isLoading: storesLoading } = useSellerStores(seller?.id)
  const store = stores[0]

  const loading = sellerLoading || storesLoading
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>(storeToForm(null))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [carrierShippingEnabled, setCarrierShippingEnabled] = useState(false)

  useEffect(() => {
    if (store) {
      setForm(storeToForm(store))
    }
  }, [store])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const settings = await getAdminShippingSettings(token)
        if (!cancelled) {
          setCarrierShippingEnabled(settings.shipping_realtime_enabled === true)
        }
      } catch {
        // Seller users may not have admin-config access; fall back to region config features.
        const regionCode = process.env.NEXT_PUBLIC_DEFAULT_REGION_CODE
        if (!regionCode || cancelled) return
        try {
          const regionCfg = await getRegionConfig(regionCode)
          if (!cancelled) {
            setCarrierShippingEnabled(regionCfg.features?.shipping_realtime_enabled === true)
          }
        } catch {
          // Keep hidden when shipping mode cannot be determined.
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setValidationErrors([])
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { valid, errors } = validateForm(form, carrierShippingEnabled)
    if (!valid) {
      setValidationErrors(errors)
      return
    }
    const token = await getAccessToken()
    if (!token) {
      setError("You must be signed in to save")
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    setValidationErrors([])
    try {
      const radius = parseInt(form.deliveryRadiusMiles, 10) || 10
      if (store) {
        const payload = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          addressCity: form.addressCity.trim() || null,
          addressState: form.addressState.trim() || null,
          addressZip: form.addressZip.trim() || null,
          addressCountry: form.addressCountry.trim() || "US",
          deliveryRadiusMiles: radius,
          shipFromSameAsBusiness: form.shipFromSameAsBusiness,
          shipFromLine1: form.shipFromSameAsBusiness ? null : form.shipFromLine1.trim() || null,
          shipFromCity: form.shipFromSameAsBusiness ? null : form.shipFromCity.trim() || null,
          shipFromState: form.shipFromSameAsBusiness ? null : form.shipFromState.trim() || null,
          shipFromZip: form.shipFromSameAsBusiness ? null : form.shipFromZip.trim() || null,
          shipFromCountry: form.shipFromSameAsBusiness ? "US" : form.shipFromCountry.trim() || "US",
          allowedCarriers: form.allowedCarriers,
          logoUrl: form.logoUrl.trim() || null,
          bannerUrl: form.bannerUrl.trim() || null,
        }
        const updated = await updateStore(token, store.id, payload)
        setForm(storeToForm(updated))
        setSuccess(true)
      } else {
        const createPayload = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          addressCity: form.addressCity.trim() || null,
          addressState: form.addressState.trim() || null,
          addressZip: form.addressZip.trim() || null,
          addressCountry: form.addressCountry.trim() || "US",
          deliveryRadiusMiles: radius,
          shipFromSameAsBusiness: form.shipFromSameAsBusiness,
          shipFromLine1: form.shipFromSameAsBusiness ? null : form.shipFromLine1.trim() || null,
          shipFromCity: form.shipFromSameAsBusiness ? null : form.shipFromCity.trim() || null,
          shipFromState: form.shipFromSameAsBusiness ? null : form.shipFromState.trim() || null,
          shipFromZip: form.shipFromSameAsBusiness ? null : form.shipFromZip.trim() || null,
          shipFromCountry: form.shipFromSameAsBusiness ? "US" : form.shipFromCountry.trim() || "US",
          allowedCarriers: form.allowedCarriers,
        }
        const created = await createStore(token, createPayload)
        if (form.logoUrl.trim() || form.bannerUrl.trim()) {
          await updateStore(token, created.id, {
            logoUrl: form.logoUrl.trim() || null,
            bannerUrl: form.bannerUrl.trim() || null,
          })
        }
        setSuccess(true)
      }
      queryClient.invalidateQueries({ queryKey: ["seller"] })
      queryClient.invalidateQueries({ queryKey: ["seller", "stores", seller?.id] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save store")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setForm(storeToForm(store))
    setValidationErrors([])
    setError(null)
    setSuccess(false)
  }

  if (sessionStatus !== "authenticated" && !loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Please sign in to manage your store settings.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading store...</span>
      </div>
    )
  }

  const carrierShipFromIncomplete =
    carrierShippingEnabled && store && !isShipFromCompleteForCarrier(storeToForm(store))

  return (
    <div className="space-y-6">
      {carrierShipFromIncomplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Carrier shipping requires a complete ship-from address</p>
          <p className="mt-1 text-amber-900/90">
            Buyers in eligible regions need live rates from your origin. Use &quot;Same as business address&quot; with a full
            business address, or enter a dedicated ship-from address below.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Store Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {store
              ? "Configure your store profile and preferences"
              : "Create your store to start selling"}
          </p>
        </div>
        {store && (
          <a
            href={`/store/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Store className="h-4 w-4" />
            View Store
          </a>
        )}
      </div>

      {(error || validationErrors.length > 0) && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {validationErrors.map((msg, i) => (
                <p key={i} className="text-sm text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-secondary/50 bg-secondary/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-secondary" />
            <p className="text-sm text-secondary">
              {store ? "Store settings saved successfully." : "Store created successfully."}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Store Info */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Store Information
              </h2>
              <p className="text-sm text-muted-foreground">
                Your store name and description visible to customers
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Store Name *
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Your Store Name"
                className={inputClass}
                maxLength={100}
              />
            </div>
            {store && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Store Slug
                </label>
                <p className="text-sm text-foreground">{store.slug}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-generated from store name. Used in store URLs.
                </p>
              </div>
            )}
            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Tell customers about your store..."
                className={textareaClass}
                maxLength={500}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {form.description.length}/500 characters
              </p>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary/10">
              <MapPin className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Location & Delivery
              </h2>
              <p className="text-sm text-muted-foreground">
                Your store address and delivery coverage
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Street Address
              </label>
              <AddressAutocomplete
                value={form.addressLine1}
                onChange={(v) => update("addressLine1", v)}
                onSelect={(parts) => {
                  setForm((prev) => ({
                    ...prev,
                    addressLine1: parts.line1,
                    addressCity: parts.city || prev.addressCity,
                    addressState: parts.state || prev.addressState,
                    addressZip: parts.zip || prev.addressZip,
                    addressCountry: (parts.country || prev.addressCountry || "US").toUpperCase(),
                  }))
                  setValidationErrors([])
                  setError(null)
                  setSuccess(false)
                }}
                placeholder="Start typing your address…"
                className={`${inputClass} !rounded-md`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="addressCity"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  City
                </label>
                <input
                  id="addressCity"
                  type="text"
                  value={form.addressCity}
                  onChange={(e) => update("addressCity", e.target.value)}
                  placeholder="Brooklyn"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="addressState"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  State
                </label>
                <input
                  id="addressState"
                  type="text"
                  value={form.addressState}
                  onChange={(e) => update("addressState", e.target.value)}
                  placeholder="NY"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="addressZip"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  ZIP Code
                </label>
                <input
                  id="addressZip"
                  type="text"
                  value={form.addressZip}
                  onChange={(e) => update("addressZip", e.target.value)}
                  placeholder="11201"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="addressCountry"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Country
                </label>
                <input
                  id="addressCountry"
                  type="text"
                  value={form.addressCountry}
                  onChange={(e) => update("addressCountry", e.target.value)}
                  placeholder="US"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="max-w-xs">
              <label
                htmlFor="deliveryRadiusMiles"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Delivery Radius (miles) *
              </label>
              <div className="relative">
                <input
                  id="deliveryRadiusMiles"
                  type="number"
                  min={1}
                  max={100}
                  value={form.deliveryRadiusMiles}
                  onChange={(e) => update("deliveryRadiusMiles", e.target.value)}
                  className={inputClass}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  mi
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Customers within this radius will see your store in proximity searches
              </p>
            </div>
          </div>
        </section>

        {/* Shipping preferences (only in realtime carrier mode) */}
        {!carrierShippingEnabled && (
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Shipping Preferences</h2>
                <p className="text-sm text-muted-foreground">
                  Carrier shipping is currently disabled by admin. Enable realtime carrier shipping to configure ship-from and carrier preferences.
                </p>
              </div>
            </div>
          </section>
        )}
        {carrierShippingEnabled && <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Shipping Preferences</h2>
              <p className="text-sm text-muted-foreground">
                Carrier preferences and ship-from address for realtime carrier shipping.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Allowed carriers</label>
              <div className="flex flex-wrap gap-2">
                {["usps", "ups", "fedex"].map((c) => {
                  const checked = form.allowedCarriers.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        update(
                          "allowedCarriers",
                          checked
                            ? form.allowedCarriers.filter((x) => x !== c)
                            : [...form.allowedCarriers, c],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        checked
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {c.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.shipFromSameAsBusiness}
                  onChange={(e) => update("shipFromSameAsBusiness", e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary"
                />
                Ship-from address is same as business address
              </label>
            </div>

            {!form.shipFromSameAsBusiness && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Ship-from street address
                  </label>
                  <AddressAutocomplete
                    value={form.shipFromLine1}
                    onChange={(v) => update("shipFromLine1", v)}
                    onSelect={(parts) => {
                      setForm((prev) => ({
                        ...prev,
                        shipFromLine1: parts.line1,
                        shipFromCity: parts.city || prev.shipFromCity,
                        shipFromState: parts.state || prev.shipFromState,
                        shipFromZip: parts.zip || prev.shipFromZip,
                        shipFromCountry: (parts.country || prev.shipFromCountry || "US").toUpperCase(),
                      }))
                      setValidationErrors([])
                      setError(null)
                      setSuccess(false)
                    }}
                    placeholder="Start typing your ship-from address…"
                    className={`${inputClass} !rounded-md`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    value={form.shipFromCity}
                    onChange={(e) => update("shipFromCity", e.target.value)}
                    placeholder="City"
                    className={inputClass}
                  />
                  <input
                    value={form.shipFromState}
                    onChange={(e) => update("shipFromState", e.target.value)}
                    placeholder="State"
                    className={inputClass}
                  />
                  <input
                    value={form.shipFromZip}
                    onChange={(e) => update("shipFromZip", e.target.value)}
                    placeholder="ZIP"
                    className={inputClass}
                  />
                  <input
                    value={form.shipFromCountry}
                    onChange={(e) => update("shipFromCountry", e.target.value)}
                    placeholder="Country (US)"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>
        </section>}

        {/* Branding */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-info/10">
              <ImageIcon className="h-4 w-4 text-info" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Branding
              </h2>
              <p className="text-sm text-muted-foreground">
                Logo and banner images for your storefront
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <ImageUploadField
              label="Store Logo"
              hint="Recommended: 256x256px, PNG or WebP"
              currentUrl={form.logoUrl}
              onUploaded={(url) => update("logoUrl", url)}
              onRemove={() => update("logoUrl", "")}
              aspect="square"
              endpoint="storeLogo"
            />
            <ImageUploadField
              label="Store Banner"
              hint="Recommended: 1200x400px, JPEG or WebP"
              currentUrl={form.bannerUrl}
              onUploaded={(url) => update("bannerUrl", url)}
              onRemove={() => update("bannerUrl", "")}
              endpoint="storeBanner"
              aspect="wide"
            />
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {store ? "Save Settings" : "Create Store"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
