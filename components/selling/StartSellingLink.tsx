"use client"

import Link from "next/link"
import { useSession, signIn } from "next-auth/react"
import { useCallback, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

type Variant = "header" | "footer" | "button" | "inline" | "bare"

const variantClass: Record<Variant, string> = {
  header:
    "flex items-center gap-1 px-3 h-full text-[13px] text-emerald-600 font-medium whitespace-nowrap hover:text-emerald-700 hover:bg-emerald-50 transition-colors",
  footer: "text-[13px] text-muted-foreground hover:text-primary transition-colors",
  button:
    "inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header hover:bg-primary/90 transition-all shadow-lg shadow-primary/20",
  inline: "inline-flex items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header hover:bg-primary/90 transition-all",
  bare: "",
}

export function StartSellingLink({
  variant = "header",
  className,
  children,
  planSlug,
  onNavigate,
}: {
  variant?: Variant
  className?: string
  children?: React.ReactNode
  /** Optional plan slug appended to onboarding callback (e.g. pricing page). */
  planSlug?: string
  /** Called on click (e.g. close a menu). */
  onNavigate?: () => void
}) {
  const { data: session, status } = useSession()
  const [pending, setPending] = useState(false)

  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  const isSeller = roles.includes("seller")

  const onboardingUrl = planSlug
    ? `/dashboard/onboarding?plan=${encodeURIComponent(planSlug)}`
    : "/dashboard/onboarding"

  const href =
    status !== "authenticated"
      ? "/auth/register?role=seller"
      : isSeller
        ? "/dashboard"
        : onboardingUrl

  const baseClass = variantClass[variant]
  const mergedClass = [baseClass, className].filter(Boolean).join(" ").trim()

  const goBuyerToSeller = useCallback(async () => {
    setPending(true)
    try {
      const res = await fetch("/api/auth/become-seller", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || "Could not enable seller access. Try again or contact support.")
        return
      }
      await signIn("keycloak", { callbackUrl: onboardingUrl, redirect: true })
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }, [onboardingUrl])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      onNavigate?.()
      if (status !== "authenticated" || isSeller || pending) return
      e.preventDefault()
      void goBuyerToSeller()
    },
    [status, isSeller, pending, goBuyerToSeller, onNavigate],
  )

  if (status === "loading") {
    return (
      <span className={`${mergedClass} inline-flex items-center gap-1 opacity-60 pointer-events-none`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        {children ?? "Start Selling"}
      </span>
    )
  }

  const defaultLabel =
    variant === "header" ? (
      <>
        Start Selling
        <ArrowRight className="h-3 w-3" />
      </>
    ) : variant === "bare" ? (
      "Start"
    ) : (
      "Start Selling"
    )

  return (
    <Link
      href={href}
      onClick={onClick}
      className={mergedClass}
      aria-busy={pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          {children ?? defaultLabel}
        </span>
      ) : (
        children ?? defaultLabel
      )}
    </Link>
  )
}
