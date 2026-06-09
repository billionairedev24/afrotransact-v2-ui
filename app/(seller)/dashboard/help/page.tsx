import Link from "next/link"
import { HelpCircle, Mail, MessageCircle, Package, DollarSign, Image as ImageIcon, Store, Truck, ShieldCheck } from "lucide-react"

export const metadata = { title: "Seller Help Center" }

const FAQ_TOPICS = [
  {
    topic: "Getting Started",
    icon: <Store className="h-5 w-5 text-brand-gold" />,
    questions: [
      { q: "How do I complete my seller onboarding?", a: "Finish the Stripe Connect flow under Dashboard → Onboarding. You'll need a government ID and a bank account to receive payouts." },
      { q: "When can I start listing products?", a: "As soon as your Stripe account is verified and your store profile is published." },
      { q: "What documents do I need?", a: "A valid government-issued ID and your bank account details for payouts. Business sellers may need a registration number." },
    ],
  },
  {
    topic: "Products & Media",
    icon: <ImageIcon className="h-5 w-5 text-brand-gold" />,
    questions: [
      { q: "How many images can I upload per product?", a: "Up to 10 images per product. JPEG, PNG, or WebP, max 5MB each." },
      { q: "Can I bulk-upload media?", a: "Yes — go to Dashboard → Media Library and use Bulk Upload." },
      { q: "How do I edit a product after publishing?", a: "Open Dashboard → Products, click the product, and edit. Changes go live immediately." },
    ],
  },
  {
    topic: "Orders & Shipping",
    icon: <Truck className="h-5 w-5 text-brand-gold" />,
    questions: [
      { q: "How do I fulfill an order?", a: "From Dashboard → Orders, open the order and mark it Shipped with a tracking number. The buyer is notified automatically." },
      { q: "What if I can't fulfill an order?", a: "Use the Cancel & Refund action on the order page. Repeated cancellations may affect your seller rating." },
      { q: "Who handles returns?", a: "You do. Buyers contact you through the order page; approved returns refund via Stripe Connect." },
    ],
  },
  {
    topic: "Payouts & Fees",
    icon: <DollarSign className="h-5 w-5 text-brand-gold" />,
    questions: [
      { q: "When do I get paid?", a: "Payouts arrive 2–5 business days after an order is marked Delivered, paid via Stripe Connect to your bank." },
      { q: "What fees does AfroTransact take?", a: "A platform commission per order plus Stripe processing fees. Your current rate is shown on Dashboard → Payouts." },
      { q: "Where do I see payout history?", a: "Dashboard → Payouts shows every payout, fee, and the orders included." },
    ],
  },
  {
    topic: "Account & Compliance",
    icon: <ShieldCheck className="h-5 w-5 text-brand-gold" />,
    questions: [
      { q: "How do I update my bank account?", a: "Open Dashboard → Onboarding → Manage Stripe Account to update banking details securely with Stripe." },
      { q: "What can't I sell?", a: "See our Seller Agreement for the full prohibited-items list. Counterfeit, hazardous, and illegal goods are not allowed." },
      { q: "How do I close my seller account?", a: "Contact support below. Pending orders and payouts must be settled first." },
    ],
  },
]

export default function SellerHelpPage() {
  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-input bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/10">
            <HelpCircle className="h-5 w-5 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Seller Help Center</h1>
            <p className="text-sm text-gray-500">Answers to common questions about selling on AfroTransact.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {FAQ_TOPICS.map((topic) => (
          <section key={topic.topic} className="rounded-2xl border border-input bg-white p-6">
            <div className="flex items-center gap-2">
              {topic.icon}
              <h2 className="text-lg font-bold text-foreground">{topic.topic}</h2>
            </div>
            <dl className="mt-4 space-y-4">
              {topic.questions.map((qa) => (
                <div key={qa.q}>
                  <dt className="text-sm font-semibold text-foreground">{qa.q}</dt>
                  <dd className="mt-1 text-sm text-gray-600">{qa.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Still need help?</h2>
            <p className="text-sm text-gray-600">Our seller support team typically replies within one business day.</p>
          </div>
          <div className="flex gap-2">
            <a
              href="mailto:sellers@afrotransact.com"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
            >
              <Mail className="h-4 w-4" />
              Email Support
            </a>
            <Link
              href="/help"
              className="inline-flex items-center gap-2 rounded-xl border border-input bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              General FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
