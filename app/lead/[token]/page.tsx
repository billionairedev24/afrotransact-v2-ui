"use client"

/**
 * A lead's own registration page, opened from the personal link we emailed
 * after meeting them at an event.
 *
 * Shares its shell and form with the scanned QR page — the only difference is
 * that this one knows who they are, so it opens already filled in with what
 * they told us at the stand and their email is fixed by the link.
 *
 * There is deliberately no "add another": the only person who should ever use
 * this page is the one named on the link.
 */

import { use, useEffect, useState } from "react"
import { toast } from "sonner"
import { LeadFields, type LeadFieldsValues } from "@/components/leads/LeadFields"
import {
  LeadPageShell, LeadPageLoading, LeadLinkDead, LeadThankYou, LeadFormLayout,
} from "@/components/leads/LeadPageShell"
import { logError } from "@/lib/errors"
import { getLeadProfile, completeLeadProfile } from "@/lib/api"

type LinkState = "checking" | "live" | "dead"

export default function LeadRegistrationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [state, setState] = useState<LinkState>("checking")
  const [initial, setInitial] = useState<Partial<LeadFieldsValues> | undefined>()
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Checked before they type anything: discovering a dead link after filling
    // in a whole form is the worst version of this page.
    getLeadProfile(token)
      .then((p) => {
        if (cancelled) return
        setInitial({
          firstName: p.firstName, lastName: p.lastName, email: p.email,
          phone: p.phone, businessName: p.businessName, sells: p.sells,
          categories: p.categories, city: p.city,
        })
        setState("live")
      })
      .catch(() => { if (!cancelled) setState("dead") })
    return () => { cancelled = true }
  }, [token])

  async function submit(values: LeadFieldsValues) {
    try {
      await completeLeadProfile(token, {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        businessName: values.businessName,
        sells: values.sells,
        categories: values.categories,
        city: values.city,
      })
      setDone(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      logError(e, "completing lead profile")
      toast.error("That didn't send. Check your connection and try again.")
      throw e
    }
  }

  return (
    <LeadPageShell>
      {state === "checking" && <LeadPageLoading />}

      {state === "dead" && (
        <LeadLinkDead message="Links stay active for two weeks. Reply to the email we sent you and we'll send a fresh one." />
      )}

      {state === "live" && done && (
        <LeadThankYou body="Our team will review your details and get in touch. Nothing else to do for now." />
      )}

      {state === "live" && !done && (
        <LeadFormLayout
          title={initial?.firstName ? `Welcome, ${initial.firstName}` : "Finish your details"}
          intro="Thanks for stopping by our stand. We've filled in what you gave us — add a little about what you sell and our team will take it from there."
        >
          <LeadFields
            voice="self"
            initial={initial}
            lockedFields={["email"]}
            requiredFields={["phone", "city", "businessName"]}
            onSubmit={submit}
            submitLabel="Send my details"
          />
        </LeadFormLayout>
      )}
    </LeadPageShell>
  )
}
