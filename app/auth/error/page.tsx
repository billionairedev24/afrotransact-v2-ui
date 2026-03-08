"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Server Configuration Error",
    description: "There is a problem with the server configuration. Please contact support.",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "You do not have permission to access this resource.",
  },
  Verification: {
    title: "Verification Failed",
    description: "The verification link may have expired or already been used.",
  },
  OAuthSignin: {
    title: "Sign-in Error",
    description: "Could not start the sign-in process. Please try again.",
  },
  OAuthCallback: {
    title: "Callback Error",
    description: "An error occurred during authentication. Please try again.",
  },
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description: "This email is already associated with another sign-in method. Please use your original sign-in method.",
  },
  Default: {
    title: "Authentication Error",
    description: "An unexpected error occurred during authentication. Please try again.",
  },
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const errorType = searchParams.get("error") || "Default"
  const { title, description } = errorMessages[errorType] ?? errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <Link href="/" className="flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="AfroTransact" width={40} height={40} className="rounded-xl" />
          <div>
            <span className="text-3xl font-bold text-primary">Afro</span>
            <span className="text-3xl font-bold text-foreground">Transact</span>
          </div>
        </Link>

        <div className="rounded-xl border border-border bg-card p-8 shadow-xl shadow-black/20 space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-card-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-accent"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              Go Home
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
