"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { getCategoryAttributes, type CategoryAttribute } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Category-driven variant builder.
 *
 * The problem it solves: a variant used to be a freeform name. "Red / M" is a
 * string, so nothing downstream could tell what actually varied — not the
 * product page, not search, not the buyer picking a size. Sellers also had no
 * way to know which option keys the server would accept, because the rules
 * existed in the validator and were never published.
 *
 * So the seller no longer types option keys at all. They pick values from the
 * category's own vocabulary, and the matrix is generated from the cartesian
 * product of those choices. That makes an invalid combination unrepresentable
 * in the UI rather than rejected after submit.
 *
 * Three states, and the empty one is the important one:
 *   - category has AXES        -> pick values, generate a matrix
 *   - category has none bound  -> render nothing; the caller keeps its existing
 *                                 freeform variant editor. Enforcement is
 *                                 opt-in per category, so an uncurated category
 *                                 must keep working exactly as it did.
 *   - no category selected yet -> prompt, because axes depend on the category
 */

export interface GeneratedVariant {
  /** Stable key for React and for matching edits back to a row. */
  id: string
  /** Canonical options: { size: "M", color: "Red" }. Sent verbatim. */
  options: Record<string, string>
  /** Human label derived from the options, e.g. "M / Red". */
  label: string
  price: string
  stockQuantity: string
  sku: string
}

interface Props {
  categoryId: string | null
  /** Seeds price/stock on freshly generated rows. */
  basePrice?: string
  baseStock?: string
  value: GeneratedVariant[]
  onChange: (variants: GeneratedVariant[]) => void
  /** Told to the caller so it can hide its own freeform editor. */
  onAxesResolved?: (hasAxes: boolean) => void
  className?: string
}

const comboId = (options: Record<string, string>) =>
  Object.keys(options)
    .sort()
    .map((k) => `${k}:${options[k]}`)
    .join("|")

export function VariantMatrixBuilder({
  categoryId,
  basePrice = "",
  baseStock = "0",
  value,
  onChange,
  onAxesResolved,
  className,
}: Props) {
  const [attributes, setAttributes] = useState<CategoryAttribute[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Which values the seller has picked per axis key. */
  const [selected, setSelected] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!categoryId) {
      setAttributes(null)
      setSelected({})
      onAxesResolved?.(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getCategoryAttributes(categoryId)
      .then((attrs) => {
        if (cancelled) return
        setAttributes(attrs)
        setSelected({})
        onAxesResolved?.(attrs.some((a) => a.variantAxis))
      })
      .catch(() => {
        if (cancelled) return
        // Failing closed here would block the seller from listing at all, so
        // we fall back to the caller's freeform editor and say why.
        setError("Could not load this category's options — you can still add variants manually.")
        setAttributes([])
        onAxesResolved?.(false)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // onAxesResolved is intentionally excluded: callers pass an inline arrow,
    // which would re-run this effect (and clear the seller's selections) on
    // every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  const axes = useMemo(
    () => (attributes ?? []).filter((a) => a.variantAxis).sort((a, b) => a.sortOrder - b.sortOrder),
    [attributes],
  )
  const specs = useMemo(() => (attributes ?? []).filter((a) => !a.variantAxis), [attributes])

  const toggleValue = (key: string, v: string) => {
    setSelected((prev) => {
      const current = prev[key] ?? []
      return {
        ...prev,
        [key]: current.includes(v) ? current.filter((x) => x !== v) : [...current, v],
      }
    })
  }

  /** Cartesian product of the chosen values, in axis order. */
  const generate = () => {
    const active = axes.filter((a) => (selected[a.key] ?? []).length > 0)
    if (active.length === 0) return

    let combos: Record<string, string>[] = [{}]
    for (const axis of active) {
      const values = selected[axis.key] ?? []
      combos = combos.flatMap((row) => values.map((v) => ({ ...row, [axis.key]: v })))
    }

    // Preserve any price/stock the seller already typed for a combination that
    // survives a re-generate — losing their edits because they added one more
    // colour would be its own small betrayal.
    const existing = new Map(value.map((v) => [comboId(v.options), v]))
    const next: GeneratedVariant[] = combos.map((options) => {
      const id = comboId(options)
      const prior = existing.get(id)
      return (
        prior ?? {
          id,
          options,
          label: Object.keys(options)
            .sort((a, b) => {
              const ai = axes.findIndex((x) => x.key === a)
              const bi = axes.findIndex((x) => x.key === b)
              return ai - bi
            })
            .map((k) => options[k])
            .join(" / "),
          price: basePrice,
          stockQuantity: baseStock,
          sku: "",
        }
      )
    })
    onChange(next)
  }

  const updateRow = (id: string, field: "price" | "stockQuantity" | "sku", v: string) =>
    onChange(value.map((row) => (row.id === id ? { ...row, [field]: v } : row)))

  const removeRow = (id: string) => onChange(value.filter((row) => row.id !== id))

  // ── Empty states ─────────────────────────────────────────────────────────
  if (!categoryId) {
    return (
      <p className={cn("rounded-lg border border-dashed border-input py-6 text-center text-sm text-gray-500", className)}>
        Choose a category first — the available options depend on it.
      </p>
    )
  }
  if (loading) {
    return (
      <p className={cn("flex items-center justify-center gap-2 py-6 text-sm text-gray-500", className)}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading options for this category…
      </p>
    )
  }
  if (error) {
    return <p className={cn("rounded-lg bg-amber-50 p-3 text-sm text-amber-800", className)}>{error}</p>
  }
  // Nothing bound to this category: the caller keeps its freeform editor.
  if (axes.length === 0) return null

  const totalCombos = axes.reduce(
    (n, a) => n * Math.max((selected[a.key] ?? []).length, 1),
    1,
  )

  return (
    <div className={cn("space-y-5", className)}>
      {/* Axis pickers */}
      <div className="space-y-4">
        {axes.map((axis) => (
          <div key={axis.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">{axis.displayName}</span>
              {axis.required && <span className="text-xs text-red-600">required</span>}
              <span className="text-xs text-gray-400">
                {(selected[axis.key] ?? []).length} selected
              </span>
            </div>

            {axis.valueSet.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {axis.valueSet.map((v) => {
                  const on = (selected[axis.key] ?? []).includes(v)
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleValue(axis.key, v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition",
                        on
                          ? "border-brand-green bg-brand-green text-white"
                          : "border-input bg-white text-gray-700 hover:border-brand-green/50",
                      )}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
            ) : (
              // A number/text axis has no fixed vocabulary. Rare, but it must
              // not silently render as "no options available".
              <FreeValueInput
                onAdd={(v) => toggleValue(axis.key, v)}
                values={selected[axis.key] ?? []}
                onRemove={(v) => toggleValue(axis.key, v)}
                unit={axis.unit}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={axes.every((a) => (selected[a.key] ?? []).length === 0)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-green-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Generate {totalCombos > 1 ? `${totalCombos} variants` : "variants"}
        </button>
        {value.length > 0 && (
          <span className="text-xs text-gray-500">
            Re-generating keeps the prices you have already entered.
          </span>
        )}
      </div>

      {/* Generated matrix */}
      {value.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-input">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Variant", "Price", "Stock", "SKU", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {value.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-sm font-medium text-foreground">{row.label}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.price}
                      onChange={(e) => updateRow(row.id, "price", e.target.value)}
                      className="w-24 rounded border border-input px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      value={row.stockQuantity}
                      onChange={(e) => updateRow(row.id, "stockQuantity", e.target.value)}
                      className="w-20 rounded border border-input px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.sku}
                      onChange={(e) => updateRow(row.id, "sku", e.target.value)}
                      placeholder="auto"
                      className="w-36 rounded border border-input px-2 py-1 font-mono text-xs"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remove ${row.label}`}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Specs are listed, not editable here, so it is obvious why they are not
          in the matrix. Putting one in variant options is rejected server-side. */}
      {specs.length > 0 && (
        <p className="text-xs text-gray-500">
          {specs.map((s) => s.displayName).join(", ")} describe the whole product rather than
          individual variants — set them in Attributes below.
        </p>
      )}
    </div>
  )
}

/** Value entry for an axis with no fixed vocabulary. */
function FreeValueInput({
  values,
  onAdd,
  onRemove,
  unit,
}: {
  values: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  unit: string | null
}) {
  const [draft, setDraft] = useState("")
  const commit = () => {
    const v = draft.trim()
    if (!v || values.includes(v)) return
    onAdd(v)
    setDraft("")
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={unit ? `Value in ${unit}` : "Add a value"}
          className="w-40 rounded border border-input px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={commit}
          className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-brand-green px-3 py-1 text-sm text-white"
            >
              {v}
              <button type="button" onClick={() => onRemove(v)} aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
