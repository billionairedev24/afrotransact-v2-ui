"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useCallback } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

type Variant = "header" | "header-inline" | "footer" | "button" | "inline" | "bare"

const variantClass: Record<Variant, string> = {
  header:
    "flex items-center gap-1 px-3 h-full text-[13px] text-emerald-600 font-medium whitespace-nowrap hover:text-emerald-700 hover:bg-emerald-50 transition-colors",
  "header-inline":
    "inline-flex items-center gap-1.5 text-white text-[14px] font-semibold hover:text-brand-gold transition-colors whitespace-nowrap",
  footer: "text-[13px] text-muted-foreground hover:text-foreground transition-colors",
  button:
    "inline-flex h-12 items-center gap-2 rounded-xl bg-brand-gold px-8 text-[15px] font-bold text-brand-gold-foreground hover:bg-brand-gold/90 transition-all shadow-lg shadow-primary/20",
  inline: "inline-flex items-center gap-2 rounded-xl bg-brand-gold px-8 text-[15px] font-bold text-brand-gold-foreground hover:bg-brand-gold/90 transition-all",
  bare: "",
}

export function StartSellingLink({
  variant = "header",
  className,
  children,
  onNavigate,
}: {
  variant?: Variant
  className?: string
  children?: React.ReactNode
  /** @deprecated retained for backward compatibility — no longer routes per-plan. */
  planSlug?: string
  /** Called on click (e.g. close a menu). */
  onNavigate?: () => void
}) {
  const { data: session, status } = useSession()

  // Self-service seller signup is open. The CTA is hidden for admins
  // and existing sellers — they have their own dashboards — but visible
  // to guests and buyers.
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  const isAdmin = roles.includes("admin")
  const isSeller = roles.includes("seller")

  const baseClass = variantClass[variant]
  const mergedClass = [baseClass, className].filter(Boolean).join(" ").trim()

  const onClick = useCallback(
    (_e: React.MouseEvent) => {
      onNavigate?.()
    },
    [onNavigate],
  )

  if (status === "loading") {
    return (
      <span className={`${mergedClass} inline-flex items-center gap-1 opacity-60 pointer-events-none`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        {children ?? "Start Selling"}
      </span>
    )
  }

  // Admins and existing sellers don't need a "Start Selling" CTA on the buyer
  // surfaces. Guests + buyers see it.
  if (isAdmin || isSeller) return null

  // Guests go through the seller-flavoured registration; signed-in buyers
  // skip straight to onboarding. Keycloak handles the upgrade-role step.
  const href = session
    ? "/dashboard/onboarding"
    : "/auth/register?role=seller&callbackUrl=/dashboard/onboarding"

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
    <Link href={href} onClick={onClick} className={mergedClass}>
      {children ?? defaultLabel}
    </Link>
  )
}
