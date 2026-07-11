"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get("error") || "Default"

  if (typeof window !== "undefined") {
    console.error("auth.error", { code })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <Link href="/" className="flex items-center justify-center">
          <Image src="/brand/logo-mark.svg" alt="AfroTransact" width={56} height={64} className="h-14 w-auto" />
        </Link>

        <div className="rounded-xl border border-border bg-card p-8 shadow-xl shadow-black/20 space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-card-foreground">We couldn&rsquo;t sign you in.</h1>
            <p className="text-sm text-muted-foreground">
              This usually clears up on a retry. If it keeps happening, please reach out to support.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-lg bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-gold-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-accent"
            >
              Try again
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
