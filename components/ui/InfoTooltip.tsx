"use client"

import { Info } from "lucide-react"
import { useState } from "react"

interface Props {
  text: string
  className?: string
  iconClassName?: string
  align?: "left" | "right"
}

/**
 * Lightweight hover/focus tooltip. Avoids pulling in a Radix dep for the
 * onboarding flow's field hints + "cannot edit after submit" warnings.
 */
export function InfoTooltip({ text, className = "", iconClassName = "", align = "left" }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
      >
        <Info className={`h-3.5 w-3.5 ${iconClassName}`} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 bottom-full mb-1.5 ${align === "right" ? "right-0" : "left-0"} w-56 rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
