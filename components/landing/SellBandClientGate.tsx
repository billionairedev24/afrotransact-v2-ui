"use client"

import { useSession } from "next-auth/react"

/**
 * Client-side role gate for the SellOnAfrotransactBand server component.
 * Returns null for admin + existing-seller sessions so the marketing
 * card doesn't appear on their buyer-side surfaces.
 */
export function SellBandClientGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  if (status === "loading") return null
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  if (roles.includes("admin") || roles.includes("seller")) return null
  return <>{children}</>
}
