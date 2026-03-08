"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Rocket, ArrowLeft } from "lucide-react"

function ComingSoonContent() {
  const searchParams = useSearchParams()
  const feature = searchParams.get("feature") || "This feature"

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
        <Rocket className="h-10 w-10 text-primary" />
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-3">Coming Soon</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        <span className="font-medium text-foreground">{feature}</span> is currently being built.
        We&apos;re working hard to bring you an amazing experience. Stay tuned!
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          Browse Products
        </Link>
      </div>
    </main>
  )
}

export default function ComingSoonPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ComingSoonContent />
    </Suspense>
  )
}
