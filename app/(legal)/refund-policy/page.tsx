import Link from "next/link"
import { RotateCcw } from "lucide-react"

export const metadata = {
  title: "Refund Policy · AfroTransact",
  description:
    "How returns and refunds work on AfroTransact — who qualifies, how to start a return, shipping, and how you get your money back.",
}

const EFFECTIVE_DATE = "July 16, 2026"
const COMPANY = "AfroTransact, LLC"
const CONTACT_EMAIL = "hello@afrotransact.com"

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-xl font-bold text-gray-900 border-b border-primary/30 pb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

const TOC = [
  { id: "qualifies", label: "Who Qualifies for a Return" },
  { id: "starting", label: "Starting Your Return" },
  { id: "shipping", label: "Shipping the Item Back" },
  { id: "money-back", label: "Getting Your Money Back" },
  { id: "special", label: "Special Cases" },
]

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <RotateCcw className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Policy</h1>
          <p className="text-xs text-gray-500">Effective {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-600 leading-relaxed">
        At {COMPANY.replace(", LLC", "")}, our goal is to make every purchase across our
        marketplace feel simple, secure, and worry-free. Still, we know that sometimes a return or
        refund is the right call. This policy lays out exactly how that works, so you always know
        where you stand.
      </p>

      <nav className="mt-8 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">On this page</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {TOC.map((t, i) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-sm text-gray-600 hover:text-primary transition-colors">
                {i + 1}. {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        <Section id="qualifies" title="1. Who Qualifies for a Return">
          <ul className="list-disc space-y-2 pl-5">
            <li>Requests must be submitted within <strong>7 days of the delivery date</strong>.</li>
            <li>
              Items should be unworn, unopened, and returned in their original packaging with all
              tags intact.
            </li>
            <li>
              Perishable goods, groceries, and other time-sensitive items generally cannot be
              returned once accepted, except where the product is spoiled or otherwise defective on
              arrival.
            </li>
          </ul>
        </Section>

        <Section id="starting" title="2. Starting Your Return">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Begin any return by reaching out to our support team (via the WhatsApp button on our
              website) within 7 days of receiving your order.
            </li>
            <li>
              You can start a return from your{" "}
              <Link href="/orders" className="text-primary underline underline-offset-2 hover:no-underline">
                orders
              </Link>{" "}
              or by emailing us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2 hover:no-underline">
                {CONTACT_EMAIL}
              </a>
              , including your order ID, the reason for the return, and any supporting photos.
            </li>
            <li>
              From there, a support specialist will walk you through the next steps and issue a
              return authorization where one is required.
            </li>
          </ul>
        </Section>

        <Section id="shipping" title="3. Shipping the Item Back">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The customer is responsible for shipping costs when a return is made simply because
              they changed their mind.
            </li>
            <li>
              We recommend shipping with tracking enabled so both you and our team can confirm the
              item&rsquo;s safe arrival.
            </li>
            <li>
              {COMPANY.replace(", LLC", "")} is responsible for shipping costs when the return is the
              result of our error, such as a damaged, incorrect, or defective item, and will cover it
              with a prepaid label or an arranged pickup.
            </li>
          </ul>
        </Section>

        <Section id="money-back" title="4. Getting Your Money Back">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              After we receive and inspect your returned item, we&rsquo;ll follow up to confirm
              whether the refund has been approved.
            </li>
            <li>
              Approved refunds go back to the original payment method used at checkout; original
              shipping fees are not included unless the return was our fault.
            </li>
            <li>
              The exact time it takes for funds to appear can differ based on your bank or payment
              provider, but we work to process our end promptly once approved.
            </li>
          </ul>
        </Section>

        <Section id="special" title="5. Special Cases">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Some products come with their own return terms due to their nature or applicable
              regulations — think personal care items or perishable goods. Where this applies, it
              will be spelled out clearly on the product page and again at checkout.
            </li>
            <li>
              Items that don&rsquo;t meet the conditions above — because they&rsquo;ve been used,
              damaged after delivery, or altered in some way — may be declined for return at our
              discretion.
            </li>
          </ul>
        </Section>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm text-gray-600 leading-relaxed">
          We&rsquo;re committed to making this process as painless as possible. If you run into any
          trouble along the way, our{" "}
          <Link href="/help" className="text-primary underline underline-offset-2 hover:no-underline">
            support team
          </Link>{" "}
          is ready to help.
          <p className="mt-3 text-xs italic text-gray-500">
            This policy may be updated from time to time. We encourage you to check back periodically
            for the most current version.
          </p>
        </div>
      </div>
    </main>
  )
}
