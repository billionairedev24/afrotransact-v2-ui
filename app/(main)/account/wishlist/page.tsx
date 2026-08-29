"use client"

import { useSession } from "next-auth/react"
import { WishlistSection } from "@/components/account/sections/WishlistSection"

export default function WishlistPage() {
  const { status } = useSession()

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    )
  }

  // Auth is gated by app/(main)/account/layout.tsx server-side.
  if (status !== "authenticated") return null

  return (
    <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Wishlist</h1>
      </div>
      <WishlistSection />
    </main>
  )
}
