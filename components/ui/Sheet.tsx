"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  side?: "right" | "left"
}

export function Sheet({ open, onClose, children, className, side = "right" }: SheetProps) {
  useEffect(() => {
    if (!open) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEsc)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "absolute top-0 bottom-0 flex w-full max-w-2xl flex-col border-white/10 shadow-2xl transition-transform duration-300 ease-out",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          open
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full",
          className,
        )}
        style={{ background: "hsl(0 0% 7%)" }}
      >
        {children}
      </div>
    </div>
  )
}

export function SheetHeader({
  children,
  onClose,
  className,
}: {
  children: ReactNode
  onClose?: () => void
  className?: string
}) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4", className)}>
      <h2 className="text-lg font-semibold text-white">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>
      {children}
    </div>
  )
}

export function SheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-3 border-t border-white/10 px-6 py-4", className)}>
      {children}
    </div>
  )
}
