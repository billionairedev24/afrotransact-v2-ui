"use client"

/**
 * The scannable QR code, for a stand.
 *
 * Shows the same code every time it is opened — the link is get-or-create
 * server-side, so a poster printed this morning still works this afternoon.
 * Print lays out the code large with the URL under it, for anyone whose camera
 * will not cooperate.
 */

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { X, Copy, Printer, Loader2 } from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { logError } from "@/lib/errors"
import { getLeadJoinLink } from "@/lib/api"

export function LeadQrDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [png, setPng] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = await getAccessToken()
        if (!session) throw new Error("Your session expired. Sign in again.")
        const link = await getLeadJoinLink(session)
        if (cancelled) return
        const target = `${window.location.origin}/lead/join/${link.token}`
        setUrl(target)
        setExpiresAt(link.expiresAt)
        // Rendered locally — the code never leaves the browser, so no third
        // party ever sees a link into our lead pipeline.
        setPng(await QRCode.toDataURL(target, { width: 640, margin: 1,
          color: { dark: "#0A0A0A", light: "#FFFFFF" } }))
      } catch (e) {
        if (cancelled) return
        logError(e, "loading lead QR code")
        setError("Could not load the QR code. Close this and try again.")
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      // Clipboard permission can be refused; showing the URL beats losing it.
      toast.success(url, { duration: 30_000 })
    }
  }

  function print() {
    window.print()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-qr-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-6 sm:rounded-2xl"
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 id="lead-qr-title" className="text-lg font-semibold text-foreground">
            Scan to join
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground print:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground print:hidden">
          Anyone who scans this fills in their own details and lands in your
          pipeline as a new lead.
        </p>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        {!error && !png && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {png && (
          <>
            <div className="flex justify-center rounded-xl border border-border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={png} alt="QR code linking to the seller sign-up form" className="h-56 w-56" />
            </div>
            <p className="mt-3 break-all text-center text-[13px] text-muted-foreground">{url}</p>
            {expiresAt && (
              <p className="mt-1 text-center text-[12px] text-muted-foreground print:hidden">
                Works until {new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </p>
            )}

            <div className="mt-5 flex gap-2 print:hidden">
              <button
                onClick={copy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
              >
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <button
                onClick={print}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
