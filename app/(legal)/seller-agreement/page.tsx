import Link from "next/link"
import { Store, FileText } from "lucide-react"

const EFFECTIVE_DATE = "March 3, 2026"
const COMPANY = "AfroTransact, LLC"
const COMPANY_SHORT = "AfroTransact"
const CONTACT_EMAIL = "sellers@afrotransact.com"

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-xl font-bold text-white border-b border-border pb-2">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

const TOC = [
  { id: "intro",             label: "Introduction"                      },
  { id: "eligibility",      label: "Seller Eligibility"                 },
  { id: "account",          label: "Seller Account"                     },
  { id: "listings",         label: "Product Listings"                   },
  { id: "prohibited",       label: "Prohibited Products"                },
  { id: "fees",             label: "Fees, Commission & Subscription"    },
  { id: "trial",            label: "Trial Period & Free Months"         },
  { id: "payments",         label: "Payments & Payouts"                 },
  { id: "fulfillment",      label: "Order Fulfillment"                  },
  { id: "taxes",            label: "Taxes"                              },
  { id: "reviews",          label: "Reviews & Ratings"                  },
  { id: "ip",               label: "Intellectual Property"              },
  { id: "compliance",       label: "Regulatory Compliance"              },
  { id: "termination",      label: "Termination & Suspension"           },
  { id: "liability",        label: "Limitation of Liability"            },
  { id: "changes",          label: "Changes to This Agreement"          },
  { id: "contact",          label: "Contact"                            },
]

export default function SellerAgreementPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Store className="h-6 w-6 text-primary" />
          <span className="text-sm text-gray-400">Legal — Sellers</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">Seller Agreement</h1>
        <p className="text-gray-400 mt-3 text-sm">
          Effective Date: <span className="text-white">{EFFECTIVE_DATE}</span>
          {" · "}
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" · "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </p>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-gray-300 leading-relaxed">
          This Seller Agreement (&quot;Agreement&quot;) is a legal contract between you (&quot;Seller&quot;) and{" "}
          {COMPANY} (&quot;{COMPANY_SHORT}&quot;). It supplements our general{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and governs
          your use of AfroTransact as a merchant. By registering as a seller, you agree to be bound by
          this Agreement.
        </div>
      </div>

      <div className="flex gap-10 lg:gap-16">
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Contents
            </p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-xs text-gray-400 hover:text-primary transition-colors py-0.5"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        <article className="flex-1 space-y-10 min-w-0">

          <Section id="intro" title="1. Introduction">
            <p>
              AfroTransact is a marketplace dedicated to immigrant-owned businesses. We provide the
              platform, technology, payment infrastructure, and audience. You, as a Seller, bring
              your products, expertise, and community connection.
            </p>
            <p>
              This Agreement defines the rights and responsibilities of both parties to ensure a
              fair, transparent, and trusted marketplace for everyone.
            </p>
          </Section>

          <Section id="eligibility" title="2. Seller Eligibility">
            <p>To register as a seller on AfroTransact, you must:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Be at least 18 years of age</li>
              <li>Operate a legitimate business (sole proprietorship, LLC, corporation, etc.)</li>
              <li>Be authorized to sell the products you list</li>
              <li>Have a valid US bank account (required for Stripe payouts)</li>
              <li>Complete identity verification as required by Stripe Connect</li>
              <li>Be located in or able to serve our active delivery regions</li>
              <li>Not have been previously banned from AfroTransact</li>
            </ul>
            <p>
              {COMPANY_SHORT} reserves the right to approve or reject seller applications at its
              sole discretion and may request additional documentation to verify eligibility.
            </p>
          </Section>

          <Section id="account" title="3. Seller Account">
            <p>
              You are responsible for maintaining the security of your seller account, including your
              password and any API credentials. You must not share your account with others or allow
              unauthorized access.
            </p>
            <p>
              You agree to provide accurate and complete information in your seller profile and to
              update it promptly when it changes. Providing false information, including fraudulent
              tax IDs or bank details, is grounds for immediate termination and may result in legal
              action.
            </p>
          </Section>

          <Section id="listings" title="4. Product Listings">
            <p>You are responsible for ensuring all product listings:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Are accurate, not misleading, and comply with applicable laws</li>
              <li>Include clear, representative photos of the actual product</li>
              <li>State accurate pricing, weight, quantity, and available variants</li>
              <li>Disclose allergen information for food products</li>
              <li>Include proper country of origin where required</li>
              <li>Do not infringe any third-party intellectual property rights</li>
              <li>Do not list prohibited items (see Section 5)</li>
            </ul>
            <p>
              {COMPANY_SHORT} reserves the right to remove or modify any listing that violates this
              Agreement, our guidelines, or applicable law, without prior notice.
            </p>
          </Section>

          <Section id="prohibited" title="5. Prohibited Products">
            <p>The following products are strictly prohibited on AfroTransact:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Illegal goods or substances</li>
              <li>Controlled substances (unless legally licensed)</li>
              <li>Alcohol or tobacco (unless you hold valid Texas permits)</li>
              <li>Weapons, explosives, or dangerous materials</li>
              <li>Counterfeit, stolen, or unauthorized replica goods</li>
              <li>Live animals</li>
              <li>Hazardous materials</li>
              <li>Products with false or misleading health claims</li>
              <li>Items that infringe trademarks, copyrights, or patents</li>
              <li>Recalled products or items banned by regulatory authorities</li>
            </ul>
            <p>
              Listing prohibited products will result in immediate removal and suspension of your
              account. Serious violations may be reported to law enforcement.
            </p>
          </Section>

          <Section id="fees" title="6. Fees, Commission & Subscription">
            <p>
              Selling on AfroTransact involves two types of fees:
            </p>
            <p>
              <strong className="text-white">A. Platform Commission:</strong> A percentage of each
              sale paid to {COMPANY_SHORT} for facilitating the transaction, providing the platform
              infrastructure, payment processing, and customer acquisition. Commission rates are
              determined by your subscription plan:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-semibold text-white pr-4">Plan</th>
                    <th className="text-right py-2 font-semibold text-white">Commission Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: "Starter", rate: "10%" },
                    { plan: "Growth",  rate: "8%"  },
                    { plan: "Pro",     rate: "6%"  },
                  ].map((row) => (
                    <tr key={row.plan} className="border-b border-border/50">
                      <td className="py-2 text-gray-300 pr-4">{row.plan}</td>
                      <td className="py-2 text-right font-semibold text-white">{row.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <strong className="text-white">B. Monthly Subscription Fee:</strong> A recurring
              subscription charged to maintain access to the platform and seller tools. Pricing is
              available at{" "}
              <Link href="/sell/pricing" className="text-primary hover:underline">
                afrotransact.com/sell/pricing
              </Link>.
            </p>
            <p>
              All fee rates are subject to change. {COMPANY_SHORT} will provide 30 days notice of
              material fee changes via email.
            </p>
          </Section>

          <Section id="trial" title="7. Trial Period & Free Months">
            <p>
              To help new sellers get established, {COMPANY_SHORT} offers the following trial structure:
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-white mb-1">Month 1 — Always Free</p>
                <p className="text-gray-400 text-sm">
                  Every new seller receives the first 30 days free, regardless of which plan they select.
                  No credit card is required to start.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-white mb-1">Month 2 — Free if You Qualify</p>
                <p className="text-gray-400 text-sm">
                  If you have listed at least{" "}
                  <strong className="text-white">9 active products</strong> in your store before
                  your Month 1 trial ends, your free period is automatically extended for another
                  30 days. This threshold is subject to change with notice.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-white mb-1">Month 3+ — Paid Subscription</p>
                <p className="text-gray-400 text-sm">
                  After your trial period ends, your selected subscription plan becomes active and
                  billing begins monthly. You will receive an email 7 days before your first charge.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              The product count threshold and trial durations are configurable by {COMPANY_SHORT} and
              may change. Any changes will be communicated to active sellers before they take effect.
            </p>
          </Section>

          <Section id="payments" title="8. Payments & Payouts">
            <p>
              {COMPANY_SHORT} uses <strong className="text-white">Stripe Connect</strong> to manage
              seller payments and payouts. To receive payouts, you must:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Complete the Stripe Connect onboarding process</li>
              <li>Provide valid bank account or debit card details to Stripe</li>
              <li>Pass Stripe&apos;s identity verification requirements</li>
            </ul>
            <p>
              <strong className="text-white">Payout timeline:</strong> After a buyer&apos;s payment is
              confirmed, {COMPANY_SHORT} releases your share (sale amount minus commission) to Stripe.
              Standard Stripe payouts typically arrive in your bank account within 2–5 business days,
              subject to Stripe&apos;s payout schedule and any account holds.
            </p>
            <p>
              <strong className="text-white">Commission deduction:</strong> Platform commission is
              deducted from your payout before transfer. You will receive a detailed breakdown in
              your seller dashboard for each payout.
            </p>
            <p>
              {COMPANY_SHORT} is not responsible for delays caused by Stripe, your bank, or inaccurate
              account information you provide. Disputes about payouts must be raised within 30 days.
            </p>
          </Section>

          <Section id="fulfillment" title="9. Order Fulfillment">
            <p>You agree to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Fulfill all orders placed through the platform promptly and as described</li>
              <li>Mark orders as fulfilled/shipped within the timeframe specified in your store settings</li>
              <li>Maintain sufficient stock to fulfill displayed inventory</li>
              <li>Contact buyers and AfroTransact support immediately if you cannot fulfill an order</li>
              <li>Handle food safety, packaging, and labeling in compliance with applicable Texas health regulations</li>
            </ul>
            <p>
              Consistent failure to fulfill orders, excessive cancellations, or repeated customer
              complaints may result in warnings, temporary suspension, or permanent removal from
              the platform.
            </p>
          </Section>

          <Section id="taxes" title="10. Taxes">
            <p>
              <strong className="text-white">Seller responsibility:</strong> You are solely responsible
              for determining and collecting any sales tax, VAT, or other applicable taxes on your
              sales, to the extent required by law.
            </p>
            <p>
              {COMPANY_SHORT} assists by calculating and displaying applicable Texas sales tax (currently
              8.25%) at checkout as a convenience. However, final tax compliance is your responsibility
              as the seller.
            </p>
            <p>
              {COMPANY_SHORT} will issue a 1099-K to sellers who meet IRS reporting thresholds in a
              given calendar year. You agree to provide accurate tax identification information (SSN
              or EIN) as required for tax reporting purposes.
            </p>
          </Section>

          <Section id="reviews" title="11. Reviews & Ratings">
            <p>
              Buyers may leave reviews and ratings on your products and store. You must not:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Incentivize buyers to leave positive reviews in exchange for discounts or gifts</li>
              <li>Submit fake reviews through third parties</li>
              <li>Threaten buyers who leave negative reviews</li>
              <li>Harass or attempt to remove legitimate negative reviews</li>
            </ul>
            <p>
              You may respond professionally to reviews through the seller dashboard. {COMPANY_SHORT}
              reserves the right to remove reviews that violate our content policies.
            </p>
          </Section>

          <Section id="ip" title="12. Intellectual Property">
            <p>
              By uploading product images, descriptions, and store content, you grant {COMPANY_SHORT}
              a non-exclusive, royalty-free, worldwide license to use, reproduce, display, and
              distribute such content for the purpose of operating and promoting the marketplace,
              including in advertising and social media.
            </p>
            <p>
              You represent and warrant that you own or have full rights to all content you submit
              and that such content does not infringe any third-party intellectual property rights.
            </p>
          </Section>

          <Section id="compliance" title="13. Regulatory Compliance">
            <p>
              You are responsible for ensuring your business operations and products comply with all
              applicable federal, state, and local laws and regulations, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Texas Department of Agriculture regulations for food products</li>
              <li>Texas Cottage Food Law (if applicable)</li>
              <li>FDA food labeling requirements</li>
              <li>Business licensing requirements in your city/county</li>
              <li>Health and safety regulations for food handling</li>
              <li>Any required permits for selling specific categories of goods</li>
            </ul>
          </Section>

          <Section id="termination" title="14. Termination & Suspension">
            <p>
              <strong className="text-white">By {COMPANY_SHORT}:</strong> We may suspend or terminate
              your seller account immediately, with or without notice, if you:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Violate this Agreement or our Terms of Service</li>
              <li>List prohibited products</li>
              <li>Engage in fraudulent activity</li>
              <li>Receive an excessive number of unresolved complaints</li>
              <li>Fail to pay subscription fees (after grace period)</li>
              <li>Provide false information in your seller profile</li>
            </ul>
            <p>
              <strong className="text-white">By Seller:</strong> You may close your seller account
              at any time through the dashboard. Closure does not relieve you of obligations for
              outstanding orders, fees, or refunds.
            </p>
            <p>
              Upon termination, your store listings will be removed. Pending payouts for completed
              orders will be processed according to the normal payout schedule.
            </p>
          </Section>

          <Section id="liability" title="15. Limitation of Liability">
            <p>
              {COMPANY_SHORT} shall not be liable for any indirect, incidental, consequential,
              or punitive damages arising from your use of the platform, including loss of revenue,
              lost customers, or any issues arising from third-party services (including Stripe,
              delivery providers, etc.).
            </p>
            <p>
              Our total liability to you under this Agreement shall not exceed the total subscription
              fees paid by you to {COMPANY_SHORT} in the 3 months preceding the claim.
            </p>
          </Section>

          <Section id="changes" title="16. Changes to This Agreement">
            <p>
              {COMPANY_SHORT} may update this Seller Agreement from time to time. Material changes will
              be communicated to you via email at least 30 days before they take effect. Your continued
              use of the seller platform after the effective date constitutes acceptance of the updated
              Agreement.
            </p>
          </Section>

          <Section id="contact" title="17. Contact">
            <p>Questions about this Seller Agreement?</p>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="font-semibold text-white">{COMPANY} — Seller Relations</p>
              <p>Austin, Texas, United States</p>
              <p>
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                General Support:{" "}
                <a href="mailto:support@afrotransact.com" className="text-primary hover:underline">
                  support@afrotransact.com
                </a>
              </p>
            </div>
          </Section>

        </article>
      </div>
    </main>
  )
}
