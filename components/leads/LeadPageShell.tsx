"use client"

/**
 * The branded shell around a lead-facing form.
 *
 * Shared by the personal registration link (/lead/[token]) and the scanned QR
 * link (/lead/join/[token]). Those two differ only in where the lead came from
 * and whether we already know their name — the page they land on should look
 * and read identically, so it lives here rather than being copied.
 */

import Image from "next/image"
import { Check, Loader2, ShieldCheck } from "lucide-react"

const STEPS = [
  { title: "You send your details", body: "" },
  { title: "We get in touch", body: "Someone from our team follows up with you." },
  { title: "You start selling", body: "We'll help you get set up." },
]

export function LeadPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Stays put while the form scrolls — the brand should not slide away on
          the one page a lead ever sees of ours. */}
      <header className="sticky top-0 z-40 bg-brand-dark">
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

      <main className="mx-auto w-full max-w-5xl px-5 py-10 lg:py-14">{children}</main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-10">
        <p className="border-t border-border pt-6 text-[13px] text-muted-foreground">
          Questions? Reply to the email we sent you and a person will answer.
        </p>
      </footer>
    </div>
  )
}

export function LeadPageLoading() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function LeadLinkDead({ message }: { message: string }) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        This link has expired
      </h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
    </section>
  )
}

export function LeadThankYou({ body }: { body: string }) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
        <Check className="h-7 w-7 text-primary-foreground" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Thank you — that&apos;s everything we need
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-muted-foreground">{body}</p>
    </section>
  )
}

/** Heading, intro, the form card and the "what happens next" column. */
export function LeadFormLayout({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <>
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          {intro}
        </p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8">
        <section className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-7">
          {children}
          <p className="mt-5 flex items-start gap-2 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              We use these details only to set up your store, and never share them.
            </span>
          </p>
        </section>

        <aside>
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
                    {s.body && (
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                        {s.body}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  )
}
