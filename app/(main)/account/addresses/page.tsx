"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { AccountShell } from "@/components/account/AccountShell"
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getUserProfile,
  type UserAddress,
} from "@/lib/api"
import { logError } from "@/lib/errors"
import {
  MapPin, Plus, Pencil, Trash2, Star, Loader2, AlertCircle, X,
} from "lucide-react"

type FormState = {
  label: string; line1: string; line2: string; city: string; state: string; postalCode: string; countryCode: string; isDefault: boolean
}
const EMPTY: FormState = { label: "", line1: "", line2: "", city: "", state: "", postalCode: "", countryCode: "US", isDefault: false }

export function AddressesSection() {
  const { status } = useSession()
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  async function load() {
    const token = await getAccessToken()
    if (!token) return
    try {
      setError(null)
      await getUserProfile(token)
      const data = await getAddresses(token)
      setAddresses(data)
    } catch (e) {
      logError(e, "loading addresses")
      setError("Failed to load addresses")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") load()
    else setLoading(false)
  }, [status])

  function openEdit(a: UserAddress) {
    setEditingId(a.id)
    setForm({ label: a.label || "", line1: a.line1, line2: a.line2 || "", city: a.city, state: a.state, postalCode: a.postalCode, countryCode: a.countryCode, isDefault: a.isDefault })
    setShowForm(true)
  }

  async function handleSave() {
    const token = await getAccessToken()
    if (!token) return
    setSaving(true)
    try {
      if (editingId) {
        await updateAddress(token, editingId, form)
      } else {
        await getUserProfile(token)
        await createAddress(token, { ...form, line2: form.line2 || undefined, label: form.label || undefined })
      }
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY)
      await load()
    } catch (e) {
      logError(e, "saving address")
      setError("Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this address?")) return
    const token = await getAccessToken()
    if (!token) return
    try {
      await deleteAddress(token, id)
      await load()
    } catch (e) {
      logError(e, "deleting address")
      setError("Delete failed")
    }
  }

  async function handleSetDefault(id: string) {
    const token = await getAccessToken()
    if (!token) return
    try {
      await setDefaultAddress(token, id)
      await load()
    } catch (e) {
      logError(e, "setting default address")
      setError("Failed to set default")
    }
  }

  const field = (label: string, key: keyof FormState, placeholder = "") => {
    const fieldId = `addr-${String(key)}`
    return (
      <div>
        <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
        <input
          id={fieldId}
          name={String(key)}
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 transition"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">
            {editingId ? "Edit address" : "New address"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("Label (e.g. Home, Work)", "label", "Home")}
            {field("Address line 1", "line1", "123 Main St")}
            {field("Line 2 (optional)", "line2", "Apt 4B")}
            {field("City", "city", "City")}
            {field("State", "state", "State")}
            {field("ZIP code", "postalCode", "ZIP")}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-brand-gold"
            />
            Set as default address
          </label>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={saving || !form.line1 || !form.city}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Save"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY) }}
              className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => { setEditingId(null); setForm(EMPTY); setShowForm(true) }}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
      >
        <Plus className="h-4 w-4" /> Add new address
      </button>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
          <h4 className="mt-4 text-sm font-semibold text-foreground">No saved addresses yet</h4>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Add a delivery address to speed through checkout next time.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <MapPin className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{a.label || "Address"}</span>
                      {a.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-semibold text-brand-gold-foreground">
                          <Star className="h-3 w-3 fill-current" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{a.city}, {a.state} {a.postalCode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!a.isDefault && (
                    <button
                      onClick={() => handleSetDefault(a.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Set as default"
                      aria-label="Set as default address"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Edit"
                    aria-label="Edit address"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AddressesPage() {
  return (
    <AccountShell
      title="Your Addresses"
      subtitle="Add, edit, or set a default delivery address for checkout."
    >
      <AddressesSection />
    </AccountShell>
  )
}
