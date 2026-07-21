import Link from "next/link"
import { RotateCcw, Truck } from "lucide-react"
import { supportWhatsAppLink } from "@/lib/support-whatsapp"

export const metadata = {
  title: "Refund Policy · AfroTransact",
  description:
    "How returns and refunds work on AfroTransact — who qualifies, how to start a return, shipping, and how you get your money back.",
}

const EFFECTIVE_DATE = "July 16, 2026"
const CONTACT_EMAIL = "hello@afrotransact.com"

// Readable, on-brand link treatment. The old `text-primary` links were the
// bright #FFD400 gold — invisible on white. brand-gold-ink is the deep amber
// token built for ~5:1 contrast; the underline makes it unmistakably a link.
const LINK =
  "font-semibold text-brand-gold-ink underline decoration-2 decoration-brand-gold/50 underline-offset-2 transition-colors hover:decoration-brand-gold"

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-24">
      <h2 className="text-xl font-bold text-gray-900 border-b-2 border-brand-gold/40 pb-2">{title}</h2>
      <div className="text-[15px] text-gray-700 leading-relaxed space-y-3">{children}</div>
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
  const whatsappHref = supportWhatsAppLink(
    "Hi AfroTransact, I'd like to start a return. My order ID is:",
  )

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      {/* Brand promise — the delivery guarantee that frames why returns are rare. */}
      <div className="flex items-center gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
        <Truck className="h-5 w-5 shrink-0 text-brand-gold-ink" />
        <p className="text-sm font-medium text-gray-800">
          Get authentic African products delivered to your doorstep anywhere in the Greater Austin
          Area within 48 hours — for just <span className="font-bold text-gray-900">$7.99</span>.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold-ink">
          <RotateCcw className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Policy</h1>
          <p className="text-xs text-gray-500">Effective {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <p className="mt-6 text-[15px] text-gray-700 leading-relaxed">
        At AfroTransact, our goal is to make every purchase across our marketplace feel simple,
        secure, and worry-free. Still, we know that sometimes a return or refund is the right call.
        This policy lays out exactly how that works, so you always know where you stand.
      </p>

      <nav className="mt-8 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">On this page</p>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {TOC.map((t, i) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                className="text-sm font-medium text-gray-700 underline-offset-2 transition-colors hover:text-brand-gold-ink hover:underline"
              >
                <span className="text-gray-400">{i + 1}.</span> {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        <Section id="qualifies" title="1. Who Qualifies for a Return">
          <ul className="list-disc space-y-2 pl-5 marker:text-brand-gold">
            <li>Requests must be submitted within <strong>7 days of the delivery date</strong>.</li>
            <li>
              Items should be unworn, unopened, and returned in their original packaging with all
              tags intact.
            </li>
            <li>
              Perishable goods, groceries, and other time-sensitive items generally cannot be
              returned once accepted, except in cases where the product is spoiled or otherwise
              defective on arrival.
            </li>
          </ul>
        </Section>

        <Section id="starting" title="2. Starting Your Return">
          <ul className="list-disc space-y-2 pl-5 marker:text-brand-gold">
            <li>
              Begin any return by reaching out to our support team via the{" "}
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={LINK}>
                  WhatsApp button
                </a>
              ) : (
                <span className="font-semibold text-gray-900">WhatsApp button</span>
              )}{" "}
              on our website or email at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                {CONTACT_EMAIL}
              </a>{" "}
              within 7 days of receiving your order.
            </li>
            <li>
              Please include your <strong>order ID</strong>, the reason for the return, and any
              supporting photos in your message (these requirements are needed to review &amp;
              process returns).
            </li>
            <li>
              From there, a support specialist will walk you through the next steps and issue a
              return authorization where one is required.
            </li>
          </ul>
        </Section>

        <Section id="shipping" title="3. Shipping the Item Back">
          <ul className="list-disc space-y-2 pl-5 marker:text-brand-gold">
            <li>
              The customer is responsible for shipping costs when a return is made simply because
              they changed their mind.
            </li>
            <li>
              We recommend shipping with tracking enabled so both you and our team can confirm the
              item&rsquo;s safe arrival.
            </li>
            <li>
              AfroTransact is responsible for shipping costs when the return is the result of our
              error, such as a damaged, incorrect, or defective item, and will cover it with a
              prepaid label or an arranged pickup.
            </li>
          </ul>
        </Section>

        <Section id="money-back" title="4. Getting Your Money Back">
          <ul className="list-disc space-y-2 pl-5 marker:text-brand-gold">
            <li>
              After we receive and inspect your returned item, we&rsquo;ll follow up to confirm
              whether the refund has been approved.
            </li>
            <li>
              Approved refunds go back to the original payment method used at checkout; original
              shipping fees are not included unless the return was our fault.
            </li>
            <li>
              The exact time it takes for funds to appear in your account can differ based on your
              bank or payment provider, but we work to process our end promptly once approved.
            </li>
          </ul>
        </Section>

        <Section id="special" title="5. Special Cases">
          <ul className="list-disc space-y-2 pl-5 marker:text-brand-gold">
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

        <div className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-5 text-[15px] text-gray-700 leading-relaxed">
          We&rsquo;re committed to making this process as painless as possible. If you run into any
          trouble along the way, our{" "}
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={LINK}>
              support team
            </a>
          ) : (
            <Link href="/help" className={LINK}>
              support team
            </Link>
          )}{" "}
          is ready to help.
          <p className="mt-3 text-xs italic text-gray-500">
            Note: This policy may be updated from time to time. We encourage you to check back on our
            website periodically for the most current version.
          </p>
        </div>
      </div>
    </main>
  )
}
