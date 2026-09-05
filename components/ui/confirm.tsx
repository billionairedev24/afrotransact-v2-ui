"use client"

import { create } from "zustand"
import { useEffect, useRef, useState } from "react"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "./Dialog"
import { cn } from "@/lib/utils"

/**
 * Promise-based confirm/prompt modals — a proper in-app replacement for the
 * native window.confirm()/window.prompt() (which render the ugly
 * "localhost:3001 says" browser chrome). Imperative like sonner's toast:
 *
 *   if (!(await confirmDialog({ title: "Delete?", variant: "danger" }))) return
 *   const reason = await promptDialog({ title: "Reason?", required: true })  // string | null
 *
 * Requires <ConfirmDialogHost/> mounted once (in the root layout).
 */

type ConfirmOpts = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
}

type PromptOpts = {
  title: string
  description?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  defaultValue?: string
  required?: boolean
  multiline?: boolean
}

type Request =
  | { kind: "confirm"; id: number; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; id: number; opts: PromptOpts; resolve: (v: string | null) => void }

const useDialogStore = create<{
  current: Request | null
  push: (r: Request) => void
  clear: () => void
}>((set) => ({
  current: null,
  push: (r) => set({ current: r }),
  clear: () => set({ current: null }),
}))

let seq = 0

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({ kind: "confirm", id: ++seq, opts, resolve })
  })
}

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({ kind: "prompt", id: ++seq, opts, resolve })
  })
}

export function ConfirmDialogHost() {
  const current = useDialogStore((s) => s.current)
  const clear = useDialogStore((s) => s.clear)
  const [text, setText] = useState("")
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  // Reset + focus the input each time a new prompt opens.
  useEffect(() => {
    if (current?.kind === "prompt") {
      setText(current.opts.defaultValue ?? "")
      // Focus after the dialog paints.
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [current])

  if (!current) return null

  const settle = (value: boolean | string | null) => {
    current.resolve(value as never)
    clear()
  }

  if (current.kind === "confirm") {
    const o = current.opts
    const danger = (o.variant ?? "danger") === "danger"
    return (
      <Dialog open onClose={() => settle(false)} className="max-w-md">
        <DialogHeader onClose={() => settle(false)}>{o.title}</DialogHeader>
        {o.description && (
          <DialogBody>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{o.description}</p>
          </DialogBody>
        )}
        <DialogFooter>
          <button
            onClick={() => settle(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {o.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={() => settle(true)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              danger
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90",
            )}
          >
            {o.confirmLabel ?? "Confirm"}
          </button>
        </DialogFooter>
      </Dialog>
    )
  }

  // prompt
  const o = current.opts
  const canSubmit = !o.required || text.trim().length > 0
  const submit = () => {
    if (!canSubmit) return
    settle(text)
  }
  return (
    <Dialog open onClose={() => settle(null)} className="max-w-md">
      <DialogHeader onClose={() => settle(null)}>{o.title}</DialogHeader>
      <DialogBody>
        {o.description && <p className="mb-3 text-sm text-muted-foreground whitespace-pre-line">{o.description}</p>}
        {o.multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={o.placeholder}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit() }}
            placeholder={o.placeholder}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}
      </DialogBody>
      <DialogFooter>
        <button
          onClick={() => settle(null)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {o.cancelLabel ?? "Cancel"}
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-gold-foreground transition-colors hover:bg-brand-gold/90 disabled:opacity-50"
        >
          {o.confirmLabel ?? "Submit"}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
