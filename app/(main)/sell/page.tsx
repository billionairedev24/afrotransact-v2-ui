"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, Gift, ShieldCheck, Sparkles, Store, TrendingUp, Users, Zap } from "lucide-react"

const STEPS = [
  { n: "01", title: "Create your account", desc: "Register as a seller in minutes. We'll verify your identity to keep the marketplace trusted." },
  { n: "02", title: "Set up your store",   desc: "Add your store name, logo, description, and delivery area. It takes less than 10 minutes." },
  { n: "03", title: "List your products",  desc: "Upload photos, write descriptions, set prices. List at least 9 products to unlock your second free month." },
  { n: "04", title: "Start selling",       desc: "Go live and start receiving orders. Payouts go directly to your bank account via Stripe." },
]

const FEATURES = [
  { icon: <TrendingUp className="h-5 w-5 text-primary" />, title: "Reach thousands of buyers", desc: "AfroTransact is the go-to marketplace for immigrants across Austin." },
  { icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />, title: "Secure, fast payouts", desc: "Stripe Connect deposits your earnings directly to your bank — no delays." },
  { icon: <Sparkles className="h-5 w-5 text-yellow-400" />, title: "First month always free", desc: "Start selling with zero commitment. No subscription fee until your trial ends." },
  { icon: <Users className="h-5 w-5 text-sky-400" />, title: "Community-first platform", desc: "Built for immigrant entrepreneurs. Our support team understands your business." },
  { icon: <Zap className="h-5 w-5 text-violet-400" />, title: "Easy store management", desc: "Manage products, orders, payouts, and analytics from one clean dashboard." },
  { icon: <Gift className="h-5 w-5 text-pink-400" />, title: "Free onboarding support", desc: "Our team will personally help you set up your store if you need assistance." },
]

export default function SellPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const isAuthenticated = status === "authenticated"

  async function handleStartSelling() {
    if (!isAuthenticated) {
      router.push("/auth/register?role=seller")
      return
    }
    setStarting(true)
    try {
      await fetch("/api/auth/set-seller-intent", { method: "POST" })
      router.push("/dashboard/onboarding")
    } catch {
      router.push("/auth/register?role=seller")
    } finally {
      setStarting(false)
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 text-center bg-gradient-to-br from-[#0d1f0d] via-background to-background">
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,168,83,0.1) 0%, transparent 60%)" }} />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-6">
            <Store className="h-3 w-3" /> For Sellers
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            Sell to your community.<br />
            <span className="text-primary">Earn on your terms.</span>
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-xl mx-auto">
            Join 200+ immigrant entrepreneurs already selling food, fashion, and cultural goods on AfroTransact.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleStartSelling}
              disabled={starting}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
            >
              {starting ? "Setting up..." : "Start Selling — Free"} <ChevronRight className="h-4 w-4" />
            </button>
            <Link href="/sell/pricing" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 text-[15px] font-semibold text-white hover:bg-white/10 transition-all">
              View Pricing
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-4">First month free · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-16 bg-card/40 border-y border-border">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Everything you need to succeed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 sm:px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white text-center mb-10">How it works</h2>
          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.n} className="flex gap-5 rounded-2xl border border-border bg-card p-5">
                <span className="text-3xl font-black text-primary/30 leading-none shrink-0">{step.n}</span>
                <div>
                  <h3 className="font-bold text-white">{step.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-gradient-to-br from-primary/10 to-transparent px-4 sm:px-6 py-16 text-center">
        <h2 className="text-3xl font-black text-white mb-4">Ready to start?</h2>
        <p className="text-gray-400 max-w-md mx-auto mb-6 text-sm">Your first month is completely free. No hidden fees, no lock-in.</p>
        <div className="flex flex-wrap gap-4 justify-center mb-6">
          {["No credit card to start", "Setup in under 10 min", "Cancel anytime"].map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-sm text-gray-300">
              <Check className="h-4 w-4 text-emerald-400" />{t}
            </span>
          ))}
        </div>
        <button
          onClick={handleStartSelling}
          disabled={starting}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header hover:bg-primary/90 transition-all disabled:opacity-60"
        >
          {starting ? "Setting up..." : isAuthenticated ? "Start Selling" : "Create Seller Account"} <ChevronRight className="h-4 w-4" />
        </button>
        <p className="text-xs text-gray-600 mt-4">
          By signing up you agree to our{" "}
          <Link href="/seller-agreement" className="underline hover:text-gray-400">Seller Agreement</Link> and{" "}
          <Link href="/terms" className="underline hover:text-gray-400">Terms of Service</Link>.
        </p>
      </section>
    </main>
  )
}
