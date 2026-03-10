import Link from "next/link"
import { Lock, Shield } from "lucide-react"

const EFFECTIVE_DATE = "March 3, 2026"
const COMPANY = "AfroTransact, LLC"
const CONTACT_EMAIL = "privacy@afrotransact.com"

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-xl font-bold text-white border-b border-border pb-2">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

const TOC = [
  { id: "overview",         label: "Overview"                         },
  { id: "what-we-collect",  label: "Information We Collect"           },
  { id: "how-we-use",       label: "How We Use Your Information"      },
  { id: "sharing",          label: "Information Sharing"              },
  { id: "payments",         label: "Payment Data & PCI Compliance"    },
  { id: "cookies",          label: "Cookies & Tracking"               },
  { id: "retention",        label: "Data Retention"                   },
  { id: "rights",           label: "Your Rights & Choices"            },
  { id: "security",         label: "Data Security"                    },
  { id: "children",         label: "Children&apos;s Privacy"          },
  { id: "transfers",        label: "International Data Transfers"     },
  { id: "ccpa",             label: "California Privacy Rights (CCPA)" },
  { id: "changes",          label: "Changes to This Policy"           },
  { id: "contact",          label: "Contact Us"                       },
]

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-sm text-gray-400">Legal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">Privacy Policy</h1>
        <p className="text-gray-400 mt-3 text-sm">
          Effective Date: <span className="text-white">{EFFECTIVE_DATE}</span>
          {" · "}
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" · "}
          <Link href="/seller-agreement" className="text-primary hover:underline">Seller Agreement</Link>
        </p>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-gray-300 leading-relaxed">
          Your privacy matters to us. This Privacy Policy explains how {COMPANY} (&quot;AfroTransact&quot;,
          &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your personal information when you use
          our platform.
        </div>
      </div>

      <div className="flex gap-10 lg:gap-16">
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" />
              Contents
            </p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-xs text-gray-400 hover:text-primary transition-colors py-0.5"
                dangerouslySetInnerHTML={{ __html: item.label }}
              />
            ))}
          </div>
        </aside>

        <article className="flex-1 space-y-10 min-w-0">

          <Section id="overview" title="1. Overview">
            <p>
              We are committed to protecting your privacy. We collect only what we need, use it to
              operate and improve our platform, and never sell your personal data to third parties.
            </p>
            <p>
              This Policy applies to all users of AfroTransact — buyers and sellers — accessing our
              website at afrotransact.com, our mobile apps, and any related services.
            </p>
          </Section>

          <Section id="what-we-collect" title="2. Information We Collect">
            <p><strong className="text-white">A. Information You Provide</strong></p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white">Account data:</strong> Name, email address, phone number, password (hashed)</li>
              <li><strong className="text-white">Profile data:</strong> Delivery address(es), profile photo</li>
              <li><strong className="text-white">Seller data:</strong> Business name, Tax ID (EIN/SSN), store details, bank account information (collected and held by Stripe, not us)</li>
              <li><strong className="text-white">Communications:</strong> Messages to our support team, order notes</li>
              <li><strong className="text-white">User content:</strong> Product reviews, ratings, photos you upload</li>
            </ul>
            <p><strong className="text-white">B. Information Collected Automatically</strong></p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white">Usage data:</strong> Pages visited, searches performed, products viewed, time on platform</li>
              <li><strong className="text-white">Device data:</strong> IP address, browser type and version, operating system, device identifiers</li>
              <li><strong className="text-white">Location data:</strong> General location derived from IP address; precise location only if you grant permission</li>
              <li><strong className="text-white">Cookies and similar technologies:</strong> See Section 6</li>
            </ul>
            <p><strong className="text-white">C. Information from Third Parties</strong></p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white">Stripe:</strong> Payment status confirmations, tokenized payment method identifiers</li>
              <li><strong className="text-white">Keycloak (Identity Provider):</strong> Authentication tokens, login events</li>
              <li><strong className="text-white">Social login:</strong> If you connect a Google or Apple account, we receive your name and email</li>
            </ul>
          </Section>

          <Section id="how-we-use" title="3. How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Create and manage your account and provide our services</li>
              <li>Process transactions and send order confirmations, receipts, and delivery updates</li>
              <li>Connect buyers with local immigrant-owned sellers</li>
              <li>Calculate and apply applicable taxes</li>
              <li>Communicate with you about your account, orders, and support requests</li>
              <li>Send marketing emails about promotions or new features (<em>you may opt out at any time</em>)</li>
              <li>Improve, personalize, and develop our platform and services</li>
              <li>Detect fraud, prevent abuse, and enforce our Terms of Service</li>
              <li>Comply with legal obligations (e.g., tax reporting, law enforcement requests)</li>
            </ul>
          </Section>

          <Section id="sharing" title="4. Information Sharing">
            <p>
              <strong className="text-white">We do not sell your personal data.</strong> We share
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-white">With sellers:</strong> Your name, delivery address, and
                phone number are shared with the seller(s) you order from, solely to fulfill your order
              </li>
              <li>
                <strong className="text-white">Service providers:</strong> Stripe (payments), Resend
                (email), AWS (hosting), Elasticsearch (search). These processors act on our behalf and
                are bound by data processing agreements
              </li>
              <li>
                <strong className="text-white">Legal requirements:</strong> When required by law, court
                order, or government authority
              </li>
              <li>
                <strong className="text-white">Business transfers:</strong> In the event of a merger,
                acquisition, or sale of all or substantially all of our assets
              </li>
              <li>
                <strong className="text-white">With your consent:</strong> For any other purpose with
                your explicit consent
              </li>
            </ul>
          </Section>

          <Section id="payments" title="5. Payment Data & PCI Compliance">
            <p>
              <strong className="text-white">AfroTransact never stores, processes, or has access to
              your payment card details.</strong> All payment information is collected via Stripe&apos;s
              certified PCI DSS Level 1 infrastructure through a secure, encrypted iframe (Stripe
              Elements) that communicates directly between your browser and Stripe.
            </p>
            <p>
              We receive from Stripe only: a non-sensitive payment confirmation, a tokenized payment
              method identifier, and the last four digits of your card for display purposes.
            </p>
            <p>
              For sellers, Stripe Connect collects and stores bank account information for payouts.
              This data is held by Stripe under their privacy policy and is not stored on AfroTransact
              servers.
            </p>
          </Section>

          <Section id="cookies" title="6. Cookies & Tracking Technologies">
            <p>We use the following types of cookies and similar technologies:</p>
            <div className="space-y-2">
              {[
                { type: "Essential", desc: "Required for the platform to function (session management, authentication, cart). Cannot be disabled." },
                { type: "Functional", desc: "Remember your preferences such as location and language settings." },
                { type: "Analytics", desc: "Help us understand how users interact with the platform (anonymized). Collected by our internal analytics." },
                { type: "Marketing", desc: "Used to show relevant promotions (only with your consent)." },
              ].map((c) => (
                <div key={c.type} className="flex gap-3">
                  <span className="text-white font-semibold shrink-0 w-24">{c.type}</span>
                  <span className="text-gray-400">{c.desc}</span>
                </div>
              ))}
            </div>
            <p>
              You can control cookies through your browser settings. Disabling essential cookies may
              prevent the platform from functioning correctly.
            </p>
          </Section>

          <Section id="retention" title="7. Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide our services. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Account data: Retained for the lifetime of your account plus 3 years after closure</li>
              <li>Order data: Retained for 7 years for tax and legal compliance</li>
              <li>Marketing preferences: Until you unsubscribe or request deletion</li>
              <li>Server logs: 90 days rolling retention</li>
              <li>Payment records: 7 years (legal/tax requirement)</li>
            </ul>
            <p>
              You may request deletion of your account and personal data at any time (subject to our
              legal retention obligations) by contacting{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section id="rights" title="8. Your Rights & Choices">
            <p>Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white">Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong className="text-white">Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong className="text-white">Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
              <li><strong className="text-white">Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong className="text-white">Opt-out of marketing:</strong> Unsubscribe from marketing emails via the link in any email or in account settings</li>
              <li><strong className="text-white">Do Not Track:</strong> We respect browser DNT signals for analytics tracking</li>
            </ul>
            <p>
              To exercise these rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>. We will respond within 30 days.
            </p>
          </Section>

          <Section id="security" title="9. Data Security">
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>TLS encryption for all data in transit (HTTPS enforced)</li>
              <li>AES-256 encryption for sensitive data at rest</li>
              <li>JWT authentication with RS256 signature verification</li>
              <li>Role-based access controls limiting employee data access</li>
              <li>Regular security audits and penetration testing</li>
              <li>Strict Content Security Policy (CSP) headers</li>
              <li>Payment data handled exclusively by Stripe (PCI DSS Level 1 certified)</li>
            </ul>
            <p>
              Despite our best efforts, no security system is impenetrable. In the event of a data
              breach affecting your personal information, we will notify you as required by applicable law.
            </p>
          </Section>

          <Section id="children" title="10. Children's Privacy">
            <p>
              Our services are not directed to persons under the age of 18. We do not knowingly collect
              personal information from children. If we become aware that a child under 18 has provided
              us personal information, we will delete it promptly. If you believe a child has provided us
              information, contact{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section id="transfers" title="11. International Data Transfers">
            <p>
              AfroTransact operates from the United States. If you access our platform from outside
              the US, please be aware that your information will be transferred to and processed in
              the United States, where data protection laws may differ from those in your country.
            </p>
            <p>
              By using the Platform, you consent to the transfer and processing of your information
              in the United States.
            </p>
          </Section>

          <Section id="ccpa" title="12. California Privacy Rights (CCPA/CPRA)">
            <p>
              If you are a California resident, the California Consumer Privacy Act (CCPA) as amended
              by the CPRA grants you additional rights:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information (with exceptions)</li>
              <li>Right to opt-out of the sale or sharing of personal information</li>
              <li>Right to non-discrimination for exercising your privacy rights</li>
              <li>Right to correct inaccurate personal information</li>
              <li>Right to limit use of sensitive personal information</li>
            </ul>
            <p>
              <strong className="text-white">We do not sell personal information</strong> as defined
              under the CCPA. To submit a verifiable consumer request, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section id="changes" title="13. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes
              by email or in-app notification and update the effective date above. Your continued use
              of the Platform after such notice constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section id="contact" title="14. Contact Us">
            <p>For privacy-related questions, requests, or concerns:</p>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="font-semibold text-white">{COMPANY} — Privacy Team</p>
              <p>Austin, Texas, United States</p>
              <p>
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-xs text-gray-500 mt-2">Response time: within 30 days of receiving your request</p>
            </div>
          </Section>

        </article>
      </div>
    </main>
  )
}
