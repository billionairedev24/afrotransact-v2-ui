"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-200",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({
  children,
  onClose,
}: {
  children: ReactNode
  onClose?: () => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("px-6 py-5 max-h-[60vh] overflow-y-auto", className)}>
      {children}
    </div>
  )
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-3 border-t border-border px-6 py-4", className)}>
      {children}
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
  loading?: boolean
}) {
  const btnClass =
    variant === "danger"
      ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
      : "bg-primary/15 text-primary hover:bg-primary/25"

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader onClose={onClose}>{title}</DialogHeader>
      <DialogBody>
        <p className="text-sm text-muted-foreground">{description}</p>
      </DialogBody>
      <DialogFooter>
        <button
          onClick={onClose}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
            btnClass
          )}
        >
          {loading && (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {confirmLabel}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
