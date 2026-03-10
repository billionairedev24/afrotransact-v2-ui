import Link from "next/link"
import { FileText, Scale } from "lucide-react"

const EFFECTIVE_DATE = "March 3, 2026"
const COMPANY = "AfroTransact, LLC"
const COMPANY_SHORT = "AfroTransact"
const CONTACT_EMAIL = "legal@afrotransact.com"

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-xl font-bold text-white border-b border-border pb-2">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

const TOC = [
  { id: "acceptance",       label: "Acceptance of Terms"           },
  { id: "services",         label: "Description of Services"       },
  { id: "eligibility",      label: "Eligibility & Accounts"        },
  { id: "buyer-terms",      label: "Buyer Terms"                   },
  { id: "payments",         label: "Payments & Pricing"            },
  { id: "shipping",         label: "Shipping & Delivery"           },
  { id: "returns",          label: "Returns & Refunds"             },
  { id: "prohibited",       label: "Prohibited Conduct"            },
  { id: "ip",               label: "Intellectual Property"         },
  { id: "privacy",          label: "Privacy"                       },
  { id: "disclaimers",      label: "Disclaimers"                   },
  { id: "liability",        label: "Limitation of Liability"       },
  { id: "indemnification",  label: "Indemnification"               },
  { id: "disputes",         label: "Disputes & Governing Law"      },
  { id: "termination",      label: "Termination"                   },
  { id: "changes",          label: "Changes to These Terms"        },
  { id: "contact",          label: "Contact Information"           },
]

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-6 w-6 text-primary" />
          <span className="text-sm text-gray-400">Legal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">Terms of Service</h1>
        <p className="text-gray-400 mt-3 text-sm">
          Effective Date: <span className="text-white">{EFFECTIVE_DATE}</span>
          {" · "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/seller-agreement" className="text-primary hover:underline">Seller Agreement</Link>
        </p>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-gray-300 leading-relaxed">
          Please read these Terms of Service (&quot;Terms&quot;) carefully before using AfroTransact. By accessing
          or using our platform, you agree to be bound by these Terms and our{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          If you do not agree, do not use our services.
        </div>
      </div>

      <div className="flex gap-10 lg:gap-16">
        {/* Table of Contents — desktop sticky sidebar */}
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
                className="block text-xs text-gray-400 hover:text-white hover:text-primary transition-colors py-0.5"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <article className="flex-1 space-y-10 min-w-0">

          <Section id="acceptance" title="1. Acceptance of Terms">
            <p>
              These Terms of Service constitute a legally binding agreement between you and{" "}
              <strong className="text-white">{COMPANY}</strong> (&quot;{COMPANY_SHORT}&quot;, &quot;we&quot;,
              &quot;us&quot;, or &quot;our&quot;) governing your access to and use of the{" "}
              afrotransact.com website, mobile applications, and associated services (collectively,
              the &quot;Platform&quot;).
            </p>
            <p>
              By creating an account, clicking &quot;I Agree,&quot; or using any part of the Platform, you
              acknowledge that you have read, understood, and agree to be bound by these Terms. If
              you are using the Platform on behalf of a business entity, you represent that you have
              authority to bind that entity.
            </p>
          </Section>

          <Section id="services" title="2. Description of Services">
            <p>
              {COMPANY_SHORT} operates an online marketplace connecting buyers with immigrant-owned
              businesses selling food, cultural goods, clothing, and related products primarily
              in Austin, Texas and surrounding cities.
            </p>
            <p>
              {COMPANY_SHORT} acts as a facilitator between buyers and sellers. We are not the seller
              or manufacturer of any products listed on the Platform. Each seller is an independent
              third party responsible for their products, listings, fulfillment, and customer service.
            </p>
            <p>
              Our services include: browsing and purchasing from seller stores, seller registration
              and store management, payment processing (facilitated through Stripe), delivery
              coordination, and customer support.
            </p>
          </Section>

          <Section id="eligibility" title="3. Eligibility & Account Registration">
            <p>
              You must be at least <strong className="text-white">18 years old</strong> to create an
              account or make purchases on the Platform. By registering, you represent and warrant
              that you meet this age requirement.
            </p>
            <p>You agree to provide accurate, current, and complete information during registration
              and to update such information to keep it accurate and current. You are responsible for
              maintaining the confidentiality of your account credentials and for all activity that
              occurs under your account.</p>
            <p>You must not create accounts using automated means, create multiple accounts for
              deceptive purposes, or register if you have previously been banned from the Platform.</p>
          </Section>

          <Section id="buyer-terms" title="4. Buyer Terms">
            <p>
              When you place an order on the Platform, you are entering into a transaction with the
              individual seller, not with {COMPANY_SHORT}. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Provide accurate shipping and contact information</li>
              <li>Pay for all purchases made through your account</li>
              <li>Accept the seller&apos;s specific product and return policies where disclosed</li>
              <li>Use products only for their intended lawful purposes</li>
              <li>Not submit fraudulent orders or chargebacks without legitimate basis</li>
            </ul>
            <p>
              {COMPANY_SHORT} reserves the right to cancel orders that appear fraudulent, violate these
              Terms, or cannot be fulfilled for any reason.
            </p>
          </Section>

          <Section id="payments" title="5. Payments & Pricing">
            <p>
              All prices are displayed in US Dollars (USD). {COMPANY_SHORT} uses{" "}
              <strong className="text-white">Stripe</strong> as its payment processor. By making a
              purchase, you agree to Stripe&apos;s{" "}
              <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline">
                Terms of Service
              </a>.
            </p>
            <p>
              <strong className="text-white">Card data security:</strong> Your payment card information
              is transmitted directly to Stripe via a secure, encrypted iframe. {COMPANY_SHORT} does not
              store, process, or have access to your full card number, CVC, or expiry date at any time.
              We receive only a tokenized payment confirmation from Stripe.
            </p>
            <p>
              Applicable Texas sales tax (currently 8.25%) will be added to your order total where
              required. Tax rates may vary and are subject to change based on applicable law.
            </p>
            <p>
              {COMPANY_SHORT} reserves the right to adjust pricing, fees, and tax calculations. Any
              changes will apply to orders placed after the effective date of the change.
            </p>
          </Section>

          <Section id="shipping" title="6. Shipping & Delivery">
            <p>
              {COMPANY_SHORT} currently serves Austin, Georgetown, Hutto, Leander, and Round Rock,
              Texas. Delivery availability, times, and fees vary by seller and location.
            </p>
            <p>
              Estimated delivery times are provided by sellers and are not guaranteed. {COMPANY_SHORT}
              is not responsible for delays caused by third-party carriers, weather, traffic,
              or events outside our control.
            </p>
            <p>
              Sellers are responsible for accurate product descriptions and timely fulfillment.
              If a seller fails to fulfill your order, {COMPANY_SHORT} will work with you to obtain a
              full refund.
            </p>
          </Section>

          <Section id="returns" title="7. Returns & Refunds">
            <p>
              Return and refund policies vary by seller. Sellers are required to disclose their
              policies on their store page. In the absence of a seller-specific policy:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Perishable goods (fresh produce, meats, prepared foods) are generally non-refundable
                unless defective or not as described</li>
              <li>Non-perishable items may be returned within 14 days of delivery if unused and in
                original condition</li>
              <li>Incorrect or damaged items are eligible for full refund or replacement</li>
            </ul>
            <p>
              To initiate a return or dispute, contact our support team at{" "}
              <a href="mailto:support@afrotransact.com" className="text-primary hover:underline">
                support@afrotransact.com
              </a>{" "}
              within 48 hours of delivery.
            </p>
          </Section>

          <Section id="prohibited" title="8. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws</li>
              <li>Circumvent, disable, or interfere with security features of the Platform</li>
              <li>Attempt to gain unauthorized access to any account, system, or data</li>
              <li>Post false, misleading, or fraudulent content including fake reviews</li>
              <li>Harass, threaten, or intimidate other users or sellers</li>
              <li>Use automated tools (bots, scrapers) to access or collect data from the Platform
                without prior written permission</li>
              <li>Engage in money laundering, fraud, or any financial crime</li>
              <li>List or sell prohibited items (illegal goods, controlled substances, weapons,
                counterfeit products)</li>
              <li>Reverse-engineer, decompile, or attempt to extract source code</li>
              <li>Use the Platform to send unsolicited commercial messages</li>
            </ul>
          </Section>

          <Section id="ip" title="9. Intellectual Property">
            <p>
              All content on the Platform — including but not limited to the {COMPANY_SHORT} name,
              logo, trademarks, software code, design, and editorial content — is the property of
              {" "}{COMPANY} or its licensors and is protected by US and international intellectual
              property laws.
            </p>
            <p>
              By uploading or submitting content to the Platform (product images, descriptions,
              reviews), you grant {COMPANY_SHORT} a non-exclusive, royalty-free, worldwide license to
              use, display, and distribute such content solely for the purpose of operating and
              promoting the Platform.
            </p>
            <p>
              You represent and warrant that you own or have the necessary rights to any content you
              submit and that such content does not infringe any third-party rights.
            </p>
          </Section>

          <Section id="privacy" title="10. Privacy">
            <p>
              Our collection and use of personal information is governed by our{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>,
              which is incorporated by reference into these Terms. By using the Platform, you consent
              to our data practices as described therein.
            </p>
          </Section>

          <Section id="disclaimers" title="11. Disclaimers">
            <p>
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
              KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW,{" "}
              {COMPANY_SHORT.toUpperCase()} DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p>
              {COMPANY_SHORT} does not warrant that the Platform will be uninterrupted, error-free, or
              free of viruses or other harmful components. We do not warrant the accuracy,
              completeness, or suitability of any product descriptions, prices, or other content.
            </p>
            <p>
              {COMPANY_SHORT} is not responsible for the quality, safety, legality, or accuracy of
              products listed by sellers. All transactions are between you and the seller.
            </p>
          </Section>

          <Section id="liability" title="12. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL {COMPANY_SHORT.toUpperCase()},
              ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, goodwill, or other intangible losses</li>
              <li>Damages resulting from unauthorized access to or use of our servers or data</li>
              <li>Damages resulting from the conduct of any third party on the Platform</li>
            </ul>
            <p>
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE GREATER OF (A)
              THE AMOUNT YOU PAID TO {COMPANY_SHORT.toUpperCase()} IN THE 12 MONTHS PRIOR TO THE EVENT
              GIVING RISE TO LIABILITY, OR (B) USD $100.
            </p>
            <p>
              Some jurisdictions do not allow certain limitations of liability. In such jurisdictions,
              our liability will be limited to the maximum extent permitted by applicable law.
            </p>
          </Section>

          <Section id="indemnification" title="13. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless {COMPANY_SHORT}, its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, judgments,
              awards, losses, costs, expenses, or fees (including reasonable attorneys&apos; fees) arising
              out of or relating to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Your use of the Platform</li>
              <li>Your violation of these Terms</li>
              <li>Content you submit to the Platform</li>
              <li>Your violation of any applicable law or third-party rights</li>
            </ul>
          </Section>

          <Section id="disputes" title="14. Disputes & Governing Law">
            <p>
              These Terms are governed by the laws of the State of Texas, United States, without
              regard to conflict of law principles.
            </p>
            <p>
              <strong className="text-white">Informal Resolution:</strong> Before initiating any
              formal dispute proceeding, you agree to first contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              and attempt to resolve the dispute informally within 30 days.
            </p>
            <p>
              <strong className="text-white">Arbitration:</strong> If informal resolution fails, any
              disputes shall be resolved by binding arbitration in Austin, Texas under the rules of
              the American Arbitration Association (AAA), except that either party may seek injunctive
              or equitable relief in a court of competent jurisdiction.
            </p>
            <p>
              <strong className="text-white">Class Action Waiver:</strong> You agree to bring claims
              only in your individual capacity and not as a plaintiff or class member in any
              purported class or representative action.
            </p>
          </Section>

          <Section id="termination" title="15. Termination">
            <p>
              {COMPANY_SHORT} may suspend or terminate your account at any time, with or without notice,
              for conduct that we believe violates these Terms, is harmful to other users, sellers,
              third parties, or the Platform, or for any other reason at our sole discretion.
            </p>
            <p>
              You may terminate your account at any time by contacting support. Termination does not
              relieve you of any obligations incurred prior to termination, including payment
              obligations.
            </p>
            <p>
              Sections that by their nature should survive termination will survive, including
              Sections on Intellectual Property, Disclaimers, Limitation of Liability, Indemnification,
              and Governing Law.
            </p>
          </Section>

          <Section id="changes" title="16. Changes to These Terms">
            <p>
              {COMPANY_SHORT} reserves the right to modify these Terms at any time. We will provide
              notice of material changes by updating the &quot;Effective Date&quot; above and, where
              appropriate, notifying you via email or in-app notification.
            </p>
            <p>
              Your continued use of the Platform after the effective date of revised Terms constitutes
              your acceptance of the changes. If you disagree with any changes, you must stop using
              the Platform.
            </p>
          </Section>

          <Section id="contact" title="17. Contact Information">
            <p>If you have questions about these Terms, please contact us:</p>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="font-semibold text-white">{COMPANY}</p>
              <p>Austin, Texas, United States</p>
              <p>
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                Support:{" "}
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
