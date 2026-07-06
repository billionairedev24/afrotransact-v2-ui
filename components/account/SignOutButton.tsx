"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

export function SignOutButton({ className }: { className?: string }) {
  function handleClick() {
    // Clear local cart state immediately so a brief redirect flash doesn't
    // show stale items. The server-side cart is unaffected — buyers see the
    // same cart again on their next sign-in (CartMergeProvider rehydrates).
    clearClientCartOnly()
    void signOut({ callbackUrl: "/" })
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
      }
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  )
}
