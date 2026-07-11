"use client"

/**
 * Admin view for buyer waitlist signups captured by the GeoGate. Filterable
 * by country (we only list countries that actually have signups). Exports
 * the filtered set as CSV — small enough that we build it client-side from
 * the already-fetched rows; no extra backend route required.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Country } from "country-state-city"
import { ChevronLeft, Download, Loader2 } from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { listWaitlistSignups, type WaitlistRow } from "@/lib/api"
import { friendlyMessage } from "@/lib/errors"

function countryName(code: string): string {
  return Country.getCountryByCode(code)?.name ?? code
}

function toCsv(rows: WaitlistRow[]): string {
  const header = ["email", "country_code", "subdivision_code", "city", "source", "created_at"]
  const esc = (v: string | null) => {
    if (v == null) return ""
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [header.join(",")]
  for (const r of rows) {
    lines.push(
      [r.email, r.country_code, r.subdivision_code, r.city, r.source, r.created_at]
        .map(esc)
        .join(","),
    )
  }
  return lines.join("\n")
}

export default function AdminWaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([])
  const [country, setCountry] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = await getAccessToken()
        if (!token) {
          setError("Admin session required.")
          return
        }
        const res = await listWaitlistSignups(token, {
          countryCode: country || undefined,
          limit: 500,
        })
        if (!cancelled) setRows(res.signups)
      } catch (err) {
        if (!cancelled) setError(friendlyMessage(err, "Failed to load waitlist."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [country])

  const availableCountries = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.country_code)
    return Array.from(set).sort()
  }, [rows])

  function exportCsv() {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `waitlist-${country || "all"}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist signups</h1>
          <p className="text-sm text-gray-600 mt-1">
            Buyers requesting launch in regions where we&apos;re not yet operational.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-xl border border-input bg-white px-3 py-2 text-sm"
          >
            <option value="">All countries</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)} ({c})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">No signups yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-input bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">State</th>
                <th className="px-4 py-2">City</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{r.email}</td>
                  <td className="px-4 py-2 text-gray-700">{countryName(r.country_code)}</td>
                  <td className="px-4 py-2 text-gray-700">{r.subdivision_code ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{r.city ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{r.source}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
