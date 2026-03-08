import { HelpCircle, Mail, MessageCircle, Package, Store } from "lucide-react"

const FAQ_TOPICS = [
  {
    topic: "Orders & Delivery",
    icon: <Package className="h-5 w-5 text-sky-400" />,
    bg: "bg-sky-500/10 border-sky-500/20",
    questions: [
      { q: "How do I track my order?",     a: "Go to My Orders in your account. Each order has a status and, once shipped, a tracking number from the seller." },
      { q: "My order hasn't arrived. What do I do?", a: "Contact the seller directly through your order page. If unresolved after 24 hours, contact our support team." },
      { q: "Can I cancel an order?",       a: "Orders can be cancelled within 15 minutes of placement if the seller hasn't accepted them yet. Contact support for later cancellations." },
    ],
  },
  {
    topic: "Payments & Refunds",
    icon: <Mail className="h-5 w-5 text-emerald-400" />,
    bg: "bg-emerald-500/10 border-emerald-500/20",
    questions: [
      { q: "What payment methods do you accept?", a: "All major credit and debit cards (Visa, Mastercard, Amex), Apple Pay, and Google Pay — all handled securely by Stripe." },
      { q: "When will I be refunded?",     a: "Approved refunds are processed within 3–5 business days to your original payment method." },
      { q: "Is my card information safe?", a: "Yes. Card details are collected directly by Stripe via encrypted iframe. AfroTransact never sees or stores your card number." },
    ],
  },
  {
    topic: "Selling on AfroTransact",
    icon: <Store className="h-5 w-5 text-primary" />,
    bg: "bg-primary/10 border-primary/20",
    questions: [
      { q: "How do I become a seller?",    a: "Visit afrotransact.com/sell and click 'Start Selling'. Registration takes about 10 minutes." },
      { q: "How do payouts work?",          a: "Earnings are paid to your bank account via Stripe Connect, typically within 2–5 business days of an order being completed." },
      { q: "What's the subscription fee?", a: "Month 1 is free. Month 2 is free if you list 9+ products. From Month 3, plans start at $29.99/month." },
    ],
  },
]

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 border border-primary/30 mx-auto mb-4">
          <HelpCircle className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-black text-white">Help Center</h1>
        <p className="text-gray-400 mt-2">Find answers to common questions</p>
      </div>

      <div className="space-y-8">
        {FAQ_TOPICS.map((topic) => (
          <div key={topic.topic} className={`rounded-2xl border ${topic.bg} p-6 space-y-4`}>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {topic.icon}
              {topic.topic}
            </h2>
            <div className="space-y-4">
              {topic.questions.map((faq) => (
                <div key={faq.q}>
                  <p className="text-sm font-semibold text-white">{faq.q}</p>
                  <p className="text-sm text-gray-400 mt-1">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-white/10 bg-card p-8 text-center">
        <MessageCircle className="h-8 w-8 text-primary mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Still need help?</h2>
        <p className="text-gray-400 text-sm mb-5">Our support team typically responds within 2 hours during business hours.</p>
        <a
          href="mailto:support@afrotransact.com"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-8 text-sm font-bold text-header hover:bg-primary/90 transition-all"
        >
          <Mail className="h-4 w-4" />
          Email Support
        </a>
      </div>
    </main>
  )
}
