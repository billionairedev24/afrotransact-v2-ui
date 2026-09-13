"use client"

import { useMemo } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductVariant } from "@/lib/api"

/**
 * Grouped, per-axis variant picker.
 *
 * The old picker listed whole variants as flat chips — "50g / Whole ($6.50)",
 * "100g / Ground ($11.00)". That is fine at four variants and unusable at
 * twelve, because the buyer has to parse a combination out of a string instead
 * of choosing a size and then a colour. It also could not express the thing
 * every mature storefront does: showing that a combination EXISTS but is not
 * buyable, rather than hiding it and leaving the buyer wondering.
 *
 * Now that variant options are canonical (`{"weight":"50g","form":"Whole"}`)
 * this can group by axis and reason about availability properly. Three states
 * per value, and the middle one is the point:
 *
 *   selectable  — a variant exists for this value given the other choices
 *   unavailable — struck through. Either no such combination exists, or the
 *                 one that does is out of stock. The buyer sees the option and
 *                 sees that it is gone, which is information; hiding it is not.
 *   selected    — current choice
 *
 * Falls back to null when variants carry no options, so legacy products with
 * freeform names keep their old flat picker rather than losing their selector.
 */

/** Swatch colours for the seeded `color` vocabulary. */
const COLOR_HEX: Record<string, string> = {
  black: "#111111",
  white: "#FFFFFF",
  grey: "#9CA3AF",
  gray: "#9CA3AF",
  red: "#DC2626",
  blue: "#2563EB",
  green: "#16A34A",
  yellow: "#FACC15",
  orange: "#EA580C",
  purple: "#7C3AED",
  pink: "#EC4899",
  brown: "#78350F",
  beige: "#E7D8B8",
  gold: "#D4AF37",
  silver: "#C0C0C0",
}
/** Multicolour has no single swatch, so it gets a conic sweep. */
const MULTI = "conic-gradient(#DC2626,#FACC15,#16A34A,#2563EB,#7C3AED,#DC2626)"

const parseOptions = (v: ProductVariant): Record<string, string> => {
  if (!v.options) return {}
  try {
    const parsed = JSON.parse(v.options)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, val]) => val != null && String(val).trim() !== "")
        .map(([k, val]) => [k, String(val)]),
    )
  } catch {
    // A malformed row must not take down the PDP — it simply has no axes and
    // falls back to the flat picker.
    return {}
  }
}

const LABELS: Record<string, string> = {
  size: "Size",
  shoe_size: "Shoe size",
  color: "Colour",
  weight: "Weight",
  form: "Form",
  volume: "Volume",
  pack_size: "Pack size",
  cut: "Cut",
  capacity: "Capacity",
}
const labelFor = (key: string) =>
  LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

export function VariantAxisSelector({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductVariant[]
  selected: ProductVariant | null
  onSelect: (v: ProductVariant) => void
}) {
  const parsed = useMemo(
    () => variants.map((v) => ({ variant: v, options: parseOptions(v) })),
    [variants],
  )

  /** Axis keys, in first-seen order so the server's sort_order survives. */
  const axes = useMemo(() => {
    const keys: string[] = []
    for (const { options } of parsed) {
      for (const k of Object.keys(options)) if (!keys.includes(k)) keys.push(k)
    }
    return keys
  }, [parsed])

  const valuesByAxis = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const axis of axes) {
      const seen: string[] = []
      for (const { options } of parsed) {
        const v = options[axis]
        if (v && !seen.includes(v)) seen.push(v)
      }
      m[axis] = seen
    }
    return m
  }, [axes, parsed])

  // No canonical options anywhere → let the caller keep its flat picker.
  if (axes.length === 0) return null

  const current = selected ? parseOptions(selected) : {}

  /**
   * The variant for a candidate selection: the other axes stay as they are and
   * this one axis changes. Picking "Red" should keep the chosen size rather
   * than resetting the whole selection.
   */
  const variantFor = (axis: string, value: string) => {
    const target = { ...current, [axis]: value }
    const exact = parsed.find(({ options }) =>
      axes.every((k) => options[k] === target[k]),
    )
    if (exact) return exact
    // No exact match — fall back to any variant carrying this value, so the
    // buyer can still move to it rather than hitting a dead control.
    return parsed.find(({ options }) => options[axis] === value)
  }

  return (
    <div className="space-y-5">
      {axes.map((axis) => {
        const isColor = axis === "color"
        return (
          <div key={axis}>
            <p className="mb-2 text-sm">
              <span className="text-gray-500">{labelFor(axis)}:</span>{" "}
              <span className="font-bold text-foreground">{current[axis] ?? "Select"}</span>
            </p>

            <div className="flex flex-wrap gap-2">
              {valuesByAxis[axis].map((value) => {
                const match = variantFor(axis, value)
                const exists = !!match
                const inStock = (match?.variant.stockQuantity ?? 0) > 0
                const disabled = !exists || !inStock
                const active = current[axis] === value

                if (isColor) {
                  const hex = COLOR_HEX[value.toLowerCase()]
                  return (
                    <button
                      key={value}
                      type="button"
                      title={disabled ? `${value} — unavailable` : value}
                      aria-label={`${value}${disabled ? " (unavailable)" : ""}`}
                      aria-pressed={active}
                      disabled={disabled}
                      onClick={() => match && onSelect(match.variant)}
                      className={cn(
                        "relative grid h-10 w-10 place-items-center rounded-full ring-offset-2 transition",
                        active ? "ring-2 ring-brand-gold" : "ring-1 ring-gray-300 hover:ring-gray-500",
                        disabled && "cursor-not-allowed opacity-40",
                      )}
                      style={
                        value.toLowerCase() === "multicolour"
                          ? { background: MULTI }
                          : { backgroundColor: hex ?? "#E5E7EB" }
                      }
                    >
                      {active && (
                        <Check
                          className={cn(
                            "h-4 w-4",
                            ["white", "beige", "yellow", "silver"].includes(value.toLowerCase())
                              ? "text-black"
                              : "text-white",
                          )}
                        />
                      )}
                      {/* Diagonal strike: the swatch is still visible, so the
                          buyer sees the colour exists and simply is not
                          available — the convention every storefront uses. */}
                      {disabled && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-full"
                          style={{
                            background:
                              "linear-gradient(to top left, transparent calc(50% - 1px), #6B7280 calc(50% - 1px), #6B7280 calc(50% + 1px), transparent calc(50% + 1px))",
                          }}
                        />
                      )}
                    </button>
                  )
                }

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    title={disabled ? `${value} — unavailable` : value}
                    onClick={() => match && onSelect(match.variant)}
                    className={cn(
                      "rounded-lg border-2 bg-white px-4 py-2 text-sm font-medium transition-all",
                      active
                        ? "border-brand-gold text-foreground shadow-sm"
                        : "border-gray-200 text-foreground hover:border-gray-400",
                      disabled && "cursor-not-allowed text-gray-400 line-through opacity-60",
                    )}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {selected && (
        <p className="text-sm text-gray-500">
          Selected:{" "}
          <span className="font-semibold text-foreground">
            {axes.map((a) => current[a]).filter(Boolean).join(" / ") || selected.name}
          </span>{" "}
          — ${selected.price.toFixed(2)}
        </p>
      )}
    </div>
  )
}
