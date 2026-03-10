"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export interface RowAction {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: "default" | "danger"
  disabled?: boolean
  hidden?: boolean
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const [positioned, setPositioned] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const visibleActions = actions.filter((a) => !a.hidden)

  const recalc = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 192
    const menuHeight = Math.max(visibleActions.length * 40 + 16, 100)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight + 20
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))

    setCoords({ top: openUp ? rect.top - 4 : rect.bottom + 4, left, openUp })
    setPositioned(true)
  }, [visibleActions.length])

  useEffect(() => {
    if (!open) { setPositioned(false); return }
    function handleClick(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function handleScroll() { recalc() }
    document.addEventListener("mousedown", handleClick)
    window.addEventListener("scroll", handleScroll, true)
    return () => { document.removeEventListener("mousedown", handleClick); window.removeEventListener("scroll", handleScroll, true) }
  }, [open, recalc])

  useLayoutEffect(() => {
    if (!open) return
    recalc()
  }, [open, recalc])

  if (visibleActions.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900",
          open && "bg-gray-100 text-gray-900"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && positioned && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              top: coords.openUp ? undefined : coords.top,
              bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              transformOrigin: coords.openUp ? "bottom right" : "top right",
            }}
          >
            {visibleActions.map((action, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); action.onClick() }}
                disabled={action.disabled}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
                  action.variant === "danger"
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                {action.icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
