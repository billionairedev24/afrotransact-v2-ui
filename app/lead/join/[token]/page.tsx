"use client"

/**
 * Where the scannable QR code lands.
 *
 * Same shell, same form, same validation as the personal registration link —
 * the only difference is that we do not know who is scanning, so nothing is
 * prefilled and every field is theirs to fill. Submitting creates a new lead.
 *
 * Nothing here is tied to one person, so there is no "add another": a stand
 * poster is scanned by one person at a time, each on their own phone.
 */

import { use, useEffect, useState } from "react"
import { toast } from "sonner"
import { LeadFields, type LeadFieldsValues } from "@/components/leads/LeadFields"
import {
  LeadPageShell, LeadPageLoading, LeadLinkDead, LeadThankYou, LeadFormLayout,
} from "@/components/leads/LeadPageShell"
import { logError } from "@/lib/errors"
import { validateLeadJoinToken, submitJoinLead } from "@/lib/api"

type LinkState = "checking" | "live" | "dead"

export default function LeadJoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [state, setState] = useState<LinkState>("checking")
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Checked before they type: discovering a retired code after filling in a
    // whole form, while standing at a stand, is the worst version of this page.
    validateLeadJoinToken(token)
      .then((r) => { if (!cancelled) setState(r.valid ? "live" : "dead") })
      .catch(() => { if (!cancelled) setState("dead") })
    return () => { cancelled = true }
  }, [token])

  async function submit(values: LeadFieldsValues & { website?: string }) {
    try {
      await submitJoinLead(token, values)
      setDone(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      logError(e, "submitting scanned lead")
      toast.error("That didn't send. Check your connection and try again.")
      throw e
    }
  }

  return (
    <LeadPageShell>
      {state === "checking" && <LeadPageLoading />}

      {state === "dead" && (
        <LeadLinkDead message="This code is no longer active. Come and see us at the stand and we'll sign you up there." />
      )}

      {state === "live" && done && (
        <LeadThankYou body="Our team will review your details and get in touch. Nothing else to do for now." />
      )}

      {state === "live" && !done && (
        <LeadFormLayout
          title="Sell on AfroTransact"
          intro="Leave your details and our team will get in touch about setting up your store. It takes about a minute."
        >
          <LeadFields
            voice="self"
            requiredFields={["phone", "city", "businessName", "categories"]}
            onSubmit={submit}
            submitLabel="Submit"
            includeHoneypot
          />
        </LeadFormLayout>
      )}
    </LeadPageShell>
  )
}
