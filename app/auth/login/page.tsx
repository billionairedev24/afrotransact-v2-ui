"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

function getSellerIntentCallbackUrl(): string | null {
  try {
    const raw = localStorage.getItem("afro_register_intent")
    if (!raw) return null
    const intent = JSON.parse(raw) as { callbackUrl?: string; role?: string }
    return intent.callbackUrl || null
  } catch {
    return null
  }
}

function LoginForm() {
  const searchParams = useSearchParams()
  const intentUrl = typeof window !== "undefined" ? getSellerIntentCallbackUrl() : null
  const callbackUrl = intentUrl || searchParams.get("callbackUrl") || "/"
  const error = searchParams.get("error")
  const reason = searchParams.get("reason")

  useEffect(() => {
    if (error === "OAuthCallback" || error === "Callback") {
      signIn("keycloak", { callbackUrl })
    }
  }, [error, callbackUrl])

  if (error === "OAuthCallback" || error === "Callback") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign-in...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/15 via-background to-background p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23EAB308' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <Image
              src="/logo.png"
              alt="AfroTransact"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <div>
              <span className="text-2xl font-bold text-primary">Afro</span>
              <span className="text-2xl font-bold text-foreground">Transact</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-black leading-tight text-foreground">
            Welcome back to<br />
            <span className="text-primary">your community</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-md">
            Sign in to continue shopping authentic products from
            immigrant-owned stores in your neighborhood.
          </p>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} AfroTransact. All rights reserved.
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex flex-col justify-center px-4 sm:px-8 lg:px-16 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
          <Image
            src="/logo.png"
            alt="AfroTransact"
            width={40}
            height={40}
            className="rounded-xl"
          />
          <div>
            <span className="text-2xl font-bold text-primary">Afro</span>
            <span className="text-2xl font-bold text-foreground">Transact</span>
          </div>
        </div>

        <div className="w-full max-w-[420px] mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-foreground">Sign in</h1>
            <p className="text-muted-foreground">
              Access your account and continue where you left off.
            </p>
          </div>

          {/* Session expired / idle notice */}
          {reason && (
            <div className={`rounded-xl border p-4 text-sm ${
              reason === "idle"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-blue-500/30 bg-blue-500/10 text-blue-300"
            }`}>
              {reason === "session_expired" && "Your session has expired. Please sign in again."}
              {reason === "idle" && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  You were signed out due to inactivity.
                </div>
              )}
              {!["session_expired", "idle"].includes(reason) && "Please sign in to continue."}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error === "OAuthSignin" && "Error starting the sign-in process. Please try again."}
              {error === "OAuthCallback" && "Error during authentication. Please try again."}
              {error === "OAuthAccountNotLinked" && "This email is already associated with another account."}
              {error === "Callback" && "Authentication error. Please try again."}
              {!["OAuthSignin", "OAuthCallback", "OAuthAccountNotLinked", "Callback"].includes(error) &&
                "Something went wrong. Please try again."}
            </div>
          )}

          {/* Social login buttons — Coming Soon */}
          <div className="space-y-3">
            <div className="group relative">
              <button
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                Coming soon
              </span>
            </div>

            <div className="group relative">
              <button
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </button>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                Coming soon
              </span>
            </div>

            <div className="group relative">
              <button
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <radialGradient id="ig-login" cx="30%" cy="107%" r="150%">
                    <stop offset="0%" stopColor="#fdf497" />
                    <stop offset="5%" stopColor="#fdf497" />
                    <stop offset="45%" stopColor="#fd5949" />
                    <stop offset="60%" stopColor="#d6249f" />
                    <stop offset="90%" stopColor="#285AEB" />
                  </radialGradient>
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-login)" strokeWidth="2" />
                  <circle cx="12" cy="12" r="5" stroke="url(#ig-login)" strokeWidth="2" />
                  <circle cx="18" cy="6" r="1.5" fill="url(#ig-login)" />
                </svg>
                Continue with Instagram
              </button>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                Coming soon
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground tracking-wider">or</span>
            </div>
          </div>

          {/* Keycloak email sign-in */}
          <button
            onClick={() => signIn("keycloak", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            Sign in with email
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </p>

          {/* Register link */}
          <div className="rounded-xl border border-border bg-card/30 p-4 text-center">
            <span className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
            </span>
            <Link
              href="/auth/register"
              className="text-sm font-semibold text-primary hover:text-accent transition-colors"
            >
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
