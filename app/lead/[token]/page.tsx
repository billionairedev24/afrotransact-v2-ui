"use client"

/**
 * A lead's own registration page, opened from the personal link we emailed
 * after meeting them at an event.
 *
 * This page belongs to the person, not to us: it carries the brand, speaks in
 * the second person, and opens already filled in with what they told us at the
 * stand. It is explicitly NOT a booth-rep tool — there is no "add another",
 * because the only person who should ever use it is the one named on the link.
 *
 * Layout: the form leads, with the three things a seller actually wants to
 * know beside it (what happens next, what it costs them, who to ask). On a
 * phone that column falls below the form, so nothing delays the first field.
 */

import { use, useEffect, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Check, Loader2, ShieldCheck } from "lucide-react"
import { LeadFields, type LeadFieldsValues } from "@/components/leads/LeadFields"
import { logError } from "@/lib/errors"
import { getLeadProfile, completeLeadProfile } from "@/lib/api"

type LinkState = "checking" | "live" | "dead"

// Deliberately generic: this page is the first thing a lead sees, and
// promising specifics we have not agreed with them yet (pricing, delivery,
// payout schedules) sets expectations nobody has signed off.
const STEPS = [
  { title: "You send your details", body: "The short form on this page — about a minute." },
  { title: "We get in touch", body: "Someone from our team follows up with you." },
  { title: "You start selling", body: "We'll help you get set up." },
]

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
    // Check the link before they type anything: discovering a dead link after
    // filling in a whole form is the worst version of this page.
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
    <div className="min-h-screen bg-muted/30">
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-5">
          <Image
            src="/brand/logo-white.svg"
            alt="AfroTransact"
            width={160}
            height={30}
            priority
            className="h-7 w-auto"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 lg:py-14">
        {state === "checking" && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "dead" && (
          <section className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8">
            <h1 className="font-display text-2xl font-semibold text-foreground">
              This link has expired
            </h1>
            <p className="mt-3 text-muted-foreground">
              Links stay active for two weeks. Reply to the email we sent you and
              we&apos;ll send a fresh one.
            </p>
          </section>
        )}

        {state === "live" && done && (
          <section className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Check className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Thank you — that&apos;s everything we need
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
              Our team will review your details and call you to set your store up.
              Nothing else to do for now.
            </p>
          </section>
        )}

        {state === "live" && !done && (
          <>
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                {initial?.firstName
                  ? `Welcome, ${initial.firstName}`
                  : "Let's get your store started"}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Thanks for stopping by our stand. We&apos;ve filled in what you gave
                us — add a little about what you sell and our team will take it
                from there.
              </p>
            </div>

            <div className="mt-8 grid items-start gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8">
              <section className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-7">
                <LeadFields
                  voice="self"
                  initial={initial}
                  lockedFields={["email"]}
                  onSubmit={submit}
                  submitLabel="Send my details"
                />
                <p className="mt-5 flex items-start gap-2 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This link is personal to you. We use these details only to set
                    up your store, and never share them.
                  </span>
                </p>
              </section>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-border bg-background p-6">
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    What happens next
                  </h2>
                  <ol className="mt-4 space-y-4">
                    {STEPS.map((s, i) => (
                      <li key={s.title} className="flex gap-3">
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                        >
                          {i + 1}
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-foreground">{s.title}</span>
                          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                            {s.body}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>

              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-10">
        <p className="border-t border-border pt-6 text-[13px] text-muted-foreground">
          Questions? Reply to the email we sent you and a person will answer.
        </p>
      </footer>
    </div>
  )
}
