"use client"

/**
 * Booth capture screen. One job: take a lead in seconds and be ready for the
 * next one. Everything that would slow that down — navigation after save, a
 * success screen, a confirmation step — is deliberately absent.
 */

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Users } from "lucide-react"
import { LeadFields } from "@/components/leads/LeadFields"
import { getAccessToken } from "@/lib/auth-helpers"
import { logError } from "@/lib/errors"
import { captureSellerLead, findDuplicateLeads, type CaptureLeadInput } from "@/lib/api"

export default function CaptureLeadPage() {
  const qc = useQueryClient()
  // Session counter, not a server stat: at a booth the useful question is
  // "how are we doing right now", and it gives a small jolt of momentum.
  const [capturedCount, setCapturedCount] = useState(0)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  const capture = useMutation({
    mutationFn: async (data: CaptureLeadInput) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again.")
      return captureSellerLead(token, data)
    },
    onSuccess: (lead) => {
      setCapturedCount((n) => n + 1)
      setDuplicateWarning(null)
      qc.invalidateQueries({ queryKey: ["admin", "seller-leads"] })
      toast.success(`Saved ${lead.firstName} ${lead.lastName}`)
    },
    onError: (e) => {
      logError(e, "capturing lead")
      toast.error("Could not save that lead. Your details are still here — tap save to try again.")
    },
  })

  async function checkDuplicate(email: string) {
    if (!email.trim()) { setDuplicateWarning(null); return }
    try {
      const token = await getAccessToken()
      if (!token) return
      const existing = await findDuplicateLeads(token, email.trim())
      setDuplicateWarning(
        existing.length > 0
          ? `Already captured as ${existing[0].firstName} ${existing[0].lastName}. Saving again is fine.`
          : null,
      )
    } catch {
      // A duplicate check is a convenience. If it fails, say nothing and let
      // the capture proceed — never block a save on a nicety.
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/admin/sellers/leads"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Pipeline
        </Link>
        {capturedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
            <Users className="h-4 w-4" />
            {capturedCount} saved
          </span>
        )}
      </div>

      <h1 className="text-2xl font-semibold text-foreground">New lead</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Name and email are enough. Everything else helps you follow up well —
        and you can send them a link to finish the rest themselves.
      </p>

      <LeadFields
        voice="admin"
        onSubmit={async (data) => { await capture.mutateAsync(data) }}
        onEmailBlur={checkDuplicate}
        duplicateWarning={duplicateWarning}
        submitLabel="Save and add another"
        // Only sensible here: an admin works through a queue of people. The
        // lead's own page never resets — one person, one submission.
        resetAfterSubmit
      />
    </div>
  )
}
