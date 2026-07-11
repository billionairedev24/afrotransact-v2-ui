"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2, AlertCircle, ShoppingCart, CheckCircle2, Percent, DollarSign } from "lucide-react"
import { API_BASE, ApiError } from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"
import { getAccessToken } from "@/lib/auth-helpers"

interface DailyPoint {
  day: string
  abandoned: number
  recovered: number
}

interface AnalyticsResponse {
  total_abandoned: number
  recovered: number
  recovery_rate: number
  avg_subtotal_cents: number
  total_lost_revenue_cents: number
  daily: DailyPoint[]
}

interface AbandonedRow {
  id: string
  order_id: string
  order_number: string
  buyer_id: string
  subtotal_cents: number | null
  total_cents: number | null
  currency: string
  item_count: number
  abandoned_at: string | null
  recovered_at: string | null
  status: "abandoned" | "recovered"
}

interface ListResponse {
  content: AbandonedRow[]
  page: number
  size: number
  total_elements: number
  total_pages: number
}

const ChartSkeleton = () => <div className="h-64 w-full animate-pulse rounded-lg bg-muted/40" />
const RecoveryChart = dynamic(() => import("./_chart").then((m) => m.RecoveryChart), {
  ssr: false,
  loading: ChartSkeleton,
})

function formatMoney(cents: number | null | undefined, currency = "USD") {
  const n = cents ?? 0
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n / 100)
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export default function AbandonedCheckoutsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [list, setList] = useState<ListResponse | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const token = await getAccessToken()
        if (!token) throw new Error("Not signed in")
        const [a, l] = await Promise.all([
          fetchJson<AnalyticsResponse>(`/api/v1/admin/analytics/abandoned-checkouts`, token),
          fetchJson<ListResponse>(`/api/v1/admin/abandoned-checkouts?page=${page}&size=25`, token),
        ])
        if (!cancelled) {
          setAnalytics(a)
          setList(l)
          setError(null)
        }
      } catch (e) {
        logError(e, "abandonedCheckouts.load")
        if (!cancelled) {
          if (e instanceof ApiError && e.status === 401) {
            setError("Your admin session has expired. Please sign in again.")
          } else if (e instanceof ApiError && e.status === 403) {
            setError("You don't have permission to view abandoned checkouts.")
          } else {
            setError(friendlyMessage(e, "Couldn't load abandoned checkouts. Please try again."))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page])

  const stats = useMemo(() => {
    if (!analytics) return null
    return [
      {
        label: "Total abandoned",
        value: analytics.total_abandoned.toLocaleString(),
        icon: ShoppingCart,
        tint: "text-gray-700",
      },
      {
        label: "Recovered",
        value: analytics.recovered.toLocaleString(),
        icon: CheckCircle2,
        tint: "text-emerald-600",
      },
      {
        label: "Recovery rate",
        value: `${analytics.recovery_rate.toFixed(1)}%`,
        icon: Percent,
        tint: "text-brand-gold",
      },
      {
        label: "Lost revenue",
        value: formatMoney(analytics.total_lost_revenue_cents),
        icon: DollarSign,
        tint: "text-red-600",
      },
    ]
  }, [analytics])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Abandoned Checkouts</h1>
        <p className="text-sm text-gray-600">
          Carts that started checkout but never paid. The cadence sends a recovery email at
          T+1h and (when relevant) T+24h with a one-tap resume link.
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" aria-hidden />
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(stats ?? Array.from({ length: 4 })).map((s, i) => {
          if (!s) {
            return (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
            )
          }
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</span>
                <Icon className={`h-4 w-4 ${s.tint}`} aria-hidden />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{s.value}</div>
            </div>
          )
        })}
      </div>

      {/* Daily chart */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Daily abandoned vs. recovered</h2>
        {analytics ? (
          <RecoveryChart data={analytics.daily} />
        ) : (
          <ChartSkeleton />
        )}
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent abandoned checkouts</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Order #</th>
                <th className="px-5 py-3">Buyer</th>
                <th className="px-5 py-3">Subtotal</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Abandoned at</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list?.content.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-800">{row.order_number}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500" title={row.buyer_id}>
                    {row.buyer_id.slice(0, 8)}…
                  </td>
                  <td className="px-5 py-3">{formatMoney(row.subtotal_cents, row.currency)}</td>
                  <td className="px-5 py-3">{row.item_count}</td>
                  <td className="px-5 py-3 text-gray-600">{formatDateTime(row.abandoned_at)}</td>
                  <td className="px-5 py-3">
                    {row.status === "recovered" ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Recovered
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        Abandoned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && list && list.content.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500" colSpan={6}>
                    No abandoned checkouts in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {list && list.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-600">
            <span>
              Page {list.page + 1} of {list.total_pages} · {list.total_elements} total
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-gray-200 px-3 py-1 font-medium disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page + 1 >= list.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-gray-200 px-3 py-1 font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
