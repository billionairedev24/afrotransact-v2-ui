import Link from "next/link"
import { ChevronRight, Copy, Gift, Users } from "lucide-react"

export default function ReferralPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 border border-primary/30 mx-auto mb-6">
        <Gift className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-black text-gray-900">Refer a Friend</h1>
      <p className="text-gray-500 mt-3 text-base leading-relaxed max-w-md mx-auto">
        Share AfroTransact with a friend. When they place their first order, you both get{" "}
        <span className="text-primary font-semibold">$5 off</span> your next order.
      </p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-card p-6 space-y-4">
        <p className="text-sm text-gray-500">Your referral link</p>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="flex-1 text-sm text-gray-900 text-left truncate">https://afrotransact.com/r/YOUR_CODE</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-header hover:bg-primary/90 transition-colors shrink-0">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
        <p className="text-xs text-gray-600">Sign in to see your personal referral link and track earnings.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        {[
          { icon: <Users className="h-5 w-5 text-sky-400" />, step: "1", title: "Share your link", desc: "Send your unique referral link to friends and family." },
          { icon: <Gift className="h-5 w-5 text-emerald-400" />, step: "2", title: "They sign up & order", desc: "Your friend creates an account and places their first order." },
          { icon: <ChevronRight className="h-5 w-5 text-primary" />, step: "3", title: "You both get $5", desc: "$5 credit is added to both accounts after the order is delivered." },
        ].map((item) => (
          <div key={item.step} className="rounded-xl border border-border bg-card p-4 space-y-2">
            {item.icon}
            <p className="text-xs text-gray-500">Step {item.step}</p>
            <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/auth/login" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-8 text-sm font-bold text-header hover:bg-primary/90 transition-all">
          Sign in to get your link <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  )
}
