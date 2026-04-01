"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

const IDLE_TIMEOUT_MS = process.env.NODE_ENV === "development" 
  ? 2 * 60 * 1000  // 2 minutes for local testing
  : 30 * 60 * 1000 // 30 minutes for production
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      clearClientCartOnly()
      void signOut({ callbackUrl: "/auth/login?reason=inactive" })
    }, IDLE_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return

    resetTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [status, resetTimer])

  return <>{children}</>
}
