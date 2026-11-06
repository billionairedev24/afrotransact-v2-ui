"use client"

/**
 * Public booth capture. Someone at the stand scans a QR code or taps a link and
 * fills this in themselves — no account, no login. The link carries a
 * short-lived token minted by an admin, so this page is only live for the
 * duration of the event.
 */

import { use, useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Loader2 } from "lucide-react"
import { LeadCaptureForm } from "@/components/leads/LeadCaptureForm"
import { logError } from "@/lib/errors"
import { submitPublicLead, validateLeadCaptureToken, type CaptureLeadInput } from "@/lib/api"

export default function PublicLeadCapturePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [linkState, setLinkState] = useState<"checking" | "live" | "dead">("checking")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    validateLeadCaptureToken(token)
      .then((res) => { if (!cancelled) setLinkState(res.valid ? "live" : "dead") })
      // Check it up front so a dead link says so immediately, rather than
      // after someone has typed out all their details.
      .catch(() => { if (!cancelled) setLinkState("dead") })
    return () => { cancelled = true }
  }, [token])

  async function submit(data: CaptureLeadInput & { website?: string }) {
    try {
      await submitPublicLead(token, data)
      setSubmitted(true)
    } catch (e) {
      logError(e, "submitting public lead")
      toast.error("Could not send that. Check your connection and tap again.")
      throw e
    }
  }

  if (linkState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (linkState === "dead") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">This link has closed</h1>
        <p className="mt-2 text-muted-foreground">
          Come and see us at the stand and we&apos;ll sign you up there.
        </p>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">You&apos;re on the list</h1>
        <p className="mt-2 text-muted-foreground">
          We&apos;ll email you a link to set up your store. Nothing else to do today.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mx-auto mt-6 text-sm font-medium text-foreground underline underline-offset-4"
        >
          Add someone else
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">Sell on AfroTransact</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Leave your details and we&apos;ll set your store up with you. Takes under a minute.
      </p>
      <LeadCaptureForm onSubmit={submit} submitLabel="Send my details" includeHoneypot />
    </main>
  )
}
