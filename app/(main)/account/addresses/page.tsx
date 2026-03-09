"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type UserAddress,
} from "@/lib/api"
import {
  MapPin, Plus, Pencil, Trash2, Star, Loader2, AlertCircle, X, ChevronLeft,
} from "lucide-react"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"

type FormState = {
  label: string; line1: string; line2: string; city: string; state: string; postalCode: string; countryCode: string; isDefault: boolean
}
const EMPTY: FormState = { label: "", line1: "", line2: "", city: "Austin", state: "TX", postalCode: "", countryCode: "US", isDefault: false }

export default function AddressesPage() {
  const { status } = useSession()
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [addressQuery, setAddressQuery] = useState("")

  async function load() {
    const token = await getAccessToken()
    if (!token) return
    try {
      setError(null)
      const data = await getAddresses(token)
      setAddresses(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load addresses")
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
    setAddressQuery(a.line1)
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
        await createAddress(token, { ...form, line2: form.line2 || undefined, label: form.label || undefined })
      }
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY)
      setAddressQuery("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
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
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  async function handleSetDefault(id: string) {
    const token = await getAccessToken()
    if (!token) return
    try {
      await setDefaultAddress(token, id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default")
    }
  }

  const inputClass = "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"

  return (
    <main className="mx-auto max-w-[700px] px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/account" className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="h-5 w-5 text-gray-400" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Saved Addresses</h1>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 p-4 mb-4" style={{ background: "hsl(0 0% 11%)" }}>
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X className="h-4 w-4 text-red-400" /></button>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-white/10 p-6 mb-6" style={{ background: "hsl(0 0% 11%)" }}>
          <h2 className="text-lg font-semibold text-white mb-4">{editingId ? "Edit Address" : "New Address"}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Label (e.g. Home, Work)</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Home"
                className={inputClass}
              />
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
                    line2: parts.line2,
                    city: parts.city,
                    state: parts.state,
                    postalCode: parts.zip,
                    countryCode: parts.country || "US",
                  }))
                }}
                placeholder="Start typing your address…"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Address Line 1</label>
                <input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="123 Main St" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Line 2 (optional)</label>
                <input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} placeholder="Apt 4B" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Austin" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">State</label>
                <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="TX" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">ZIP Code</label>
                <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="78701" className={inputClass} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-white/20"
            />
            <label className="text-sm text-gray-300">Set as default address</label>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={saving || !form.line1 || !form.city}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[#0f0f10] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Save"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY); setAddressQuery("") }}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => { setEditingId(null); setForm(EMPTY); setAddressQuery(""); setShowForm(true) }}
        className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors w-full justify-center mb-6"
      >
        <Plus className="h-4 w-4" /> Add New Address
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-gray-400">Loading…</span>
        </div>
      ) : addresses.length === 0 ? (
        <div className="py-16 text-center">
          <MapPin className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-white/10 p-5" style={{ background: "hsl(0 0% 11%)" }}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{a.label || "Address"}</span>
                      {a.isDefault && (
                        <span className="flex items-center gap-1 text-xs text-primary font-medium">
                          <Star className="h-3 w-3 fill-current" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                    <p className="text-sm text-gray-400">{a.city}, {a.state} {a.postalCode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!a.isDefault && (
                    <button onClick={() => handleSetDefault(a.id)} className="p-1.5 rounded-lg hover:bg-white/10" title="Set as default">
                      <Star className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-white/10" title="Edit">
                    <Pencil className="h-4 w-4 text-gray-400" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" title="Delete">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
