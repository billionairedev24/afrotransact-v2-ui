"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { Store, ShoppingBag, ArrowRight } from "lucide-react"

function RegisterForm() {
  const searchParams = useSearchParams()
  const role = searchParams.get("role")
  const isSeller = role === "seller"
  const callbackUrl = isSeller ? "/dashboard/onboarding" : "/"

  const handleEmailRegister = () => {
    if (isSeller) {
      localStorage.setItem("afro_register_intent", JSON.stringify({ callbackUrl, role: "seller" }))
      document.cookie = "afro_seller_intent=1; path=/; max-age=2592000; SameSite=Lax"
      // Dedicated provider lets the jwt callback detect seller intent
      // and persist registration_role to Keycloak — works across devices.
      signIn("keycloak-register-seller", { callbackUrl })
    } else {
      signIn("keycloak-register", { callbackUrl })
    }
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

        <div className="relative z-10 space-y-8">
          {isSeller ? (
            <>
              <h2 className="text-4xl font-black leading-tight text-foreground">
                Grow your business<br />
                <span className="text-primary">with your community</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-md">
                Reach thousands of customers who are looking for authentic products 
                and services from their community. First month free.
              </p>
              <div className="space-y-4">
                {[
                  "Zero setup fees, cancel anytime",
                  "Built-in payments & order management",
                  "Real-time analytics & customer insights",
                  "Dedicated seller support team",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-black leading-tight text-foreground">
                Every flavor of home,<br />
                <span className="text-primary">delivered to you</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-md">
                Discover authentic food, spices, fashion, and cultural goods from 
                immigrant-owned stores in your neighborhood.
              </p>
              <div className="space-y-4">
                {[
                  "Fresh produce & authentic spices",
                  "Support local immigrant-owned businesses",
                  "Fast delivery in Austin, TX",
                  "Secure payments & buyer protection",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} AfroTransact. All rights reserved.
        </div>
      </div>

      {/* Right panel - Registration form */}
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
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground mb-2">
              {isSeller ? (
                <>
                  <Store className="h-3.5 w-3.5 text-primary" />
                  Seller Account
                </>
              ) : (
                <>
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  Shopper Account
                </>
              )}
            </div>
            <h1 className="text-3xl font-black text-foreground">
              {isSeller ? "Start selling today" : "Create your account"}
            </h1>
            <p className="text-muted-foreground">
              {isSeller
                ? "Set up your store and start reaching customers in your community."
                : "Join the community and discover authentic products from local stores."}
            </p>
          </div>

          {/* Social registration buttons */}
          <div className="space-y-3">
            <button
              onClick={() => { if (isSeller) { localStorage.setItem("afro_register_intent", JSON.stringify({ callbackUrl, role: "seller" })); document.cookie = "afro_seller_intent=1; path=/; max-age=2592000; SameSite=Lax" } signIn("keycloak", { callbackUrl }, { kc_idp_hint: "google" }) }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-card-foreground transition-all hover:bg-muted hover:border-muted-foreground/20"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => { if (isSeller) { localStorage.setItem("afro_register_intent", JSON.stringify({ callbackUrl, role: "seller" })); document.cookie = "afro_seller_intent=1; path=/; max-age=2592000; SameSite=Lax" } signIn("keycloak", { callbackUrl }, { kc_idp_hint: "facebook" }) }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-card-foreground transition-all hover:bg-muted hover:border-muted-foreground/20"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground tracking-wider">
                or register with email
              </span>
            </div>
          </div>

          {/* Email registration */}
          <button
            onClick={handleEmailRegister}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            Register with email
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </p>

          {/* Sign-in link */}
          <div className="rounded-xl border border-border bg-card/30 p-4 text-center">
            <span className="text-sm text-muted-foreground">
              Already have an account?{" "}
            </span>
            <Link
              href="/auth/login"
              className="text-sm font-semibold text-primary hover:text-accent transition-colors"
            >
              Sign in
            </Link>
          </div>

          {/* Role switcher */}
          {!isSeller ? (
            <div className="text-center">
              <Link
                href="/auth/register?role=seller"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
              >
                <Store className="h-4 w-4" />
                Want to sell on AfroTransact?
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
              >
                <ShoppingBag className="h-4 w-4" />
                Just looking to shop?
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
