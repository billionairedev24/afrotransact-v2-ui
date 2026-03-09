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
  type StoreDetail,
} from "@/lib/api"
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
  deliveryRadiusMiles: string
  logoUrl: string
  bannerUrl: string
}

function storeToForm(store: StoreDetail | null): FormData {
  if (!store) {
    return {
      name: "",
      description: "",
      addressLine1: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
      deliveryRadiusMiles: "10",
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
    deliveryRadiusMiles: String(store.deliveryRadiusMiles ?? 10),
    logoUrl: store.logoUrl ?? "",
    bannerUrl: store.bannerUrl ?? "",
  }
}

function validateForm(data: FormData): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data.name.trim()) errors.push("Store name is required")
  if (data.name.length > 100) errors.push("Store name must be 100 characters or less")
  if (data.description.length > 500) errors.push("Description must be 500 characters or less")
  const radius = parseInt(data.deliveryRadiusMiles, 10)
  if (isNaN(radius) || radius < 1 || radius > 100) errors.push("Delivery radius must be between 1 and 100 miles")
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
  const { status } = useSession()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [store, setStore] = useState<StoreDetail | null>(null)
  const [form, setForm] = useState<FormData>(storeToForm(null))
  const [storeAddressQuery, setStoreAddressQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      const token = await getAccessToken()
      if (!token) return
      try {
        const seller = await getCurrentSeller(token)
        const stores = await getSellerStores(token, seller.id)
        const existingStore = stores.length > 0 ? stores[0] : null
        if (!cancelled) {
          setStore(existingStore)
          setForm(storeToForm(existingStore))
          setStoreAddressQuery(existingStore?.addressLine1 ?? "")
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load store")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [status])

  function update<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setValidationErrors([])
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { valid, errors } = validateForm(form)
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
          deliveryRadiusMiles: radius,
          logoUrl: form.logoUrl.trim() || null,
          bannerUrl: form.bannerUrl.trim() || null,
        }
        const updated = await updateStore(token, store.id, payload)
        setStore(updated)
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
          deliveryRadiusMiles: radius,
        }
        const created = await createStore(token, createPayload)
        let finalStore = created
        if (form.logoUrl.trim() || form.bannerUrl.trim()) {
          finalStore = await updateStore(token, created.id, {
            logoUrl: form.logoUrl.trim() || null,
            bannerUrl: form.bannerUrl.trim() || null,
          })
        }
        setStore(finalStore)
        setForm(storeToForm(finalStore))
        setSuccess(true)
      }
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

  if (status !== "authenticated" && !loading) {
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

  return (
    <div className="space-y-6">
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
                Address
              </label>
              <AddressAutocomplete
                value={storeAddressQuery}
                onChange={setStoreAddressQuery}
                onSelect={(parts) => {
                  update("addressLine1", parts.line1)
                  update("addressCity", parts.city)
                  update("addressState", parts.state)
                  update("addressZip", parts.zip)
                }}
                placeholder="Start typing your store address…"
              />
            </div>
            <div>
              <label
                htmlFor="addressLine1"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Street Address
              </label>
              <input
                id="addressLine1"
                type="text"
                value={form.addressLine1}
                onChange={(e) => update("addressLine1", e.target.value)}
                placeholder="123 Main St"
                className={inputClass}
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
