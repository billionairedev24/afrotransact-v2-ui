"use client"

/**
 * Toggle — the single shared switch control for the whole app.
 *
 * ON  = brand-gold track, white knob at the right.
 * OFF = a clearly visible neutral track (NOT bg-muted, which nearly
 *       vanishes on a light card) with a subtle inner ring so the
 *       control still reads as "present" when off.
 *
 * Use this everywhere a switch/toggle is needed so the brand yellow and
 * the off-state are identical across every surface.
 */
export interface ToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? "bg-brand-gold"
          : "bg-zinc-300 dark:bg-zinc-600 ring-1 ring-inset ring-black/10 dark:ring-white/10"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  )
}
