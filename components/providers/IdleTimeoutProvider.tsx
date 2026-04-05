"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

// How long the user can be idle before being logged out
const IDLE_MS = process.env.NODE_ENV === "development"
  ? 3 * 60 * 1000   // 3 min in dev so you can test
  : 30 * 60 * 1000  // 30 min in production

// How long before logout to show the warning modal
const WARN_BEFORE_MS = 2 * 60 * 1000 // warn 2 minutes before logout

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const

// ─── Warning modal ────────────────────────────────────────────────────────────

function IdleWarningModal({
  secondsLeft,
  onStayLoggedIn,
  onLogOutNow,
}: {
  secondsLeft: number
  onStayLoggedIn: () => void
  onLogOutNow: () => void
}) {
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}s`

  // Danger colour shifts from amber → red in the last 30 seconds
  const urgent = secondsLeft <= 30

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session timeout warning"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        {/* Icon + countdown ring */}
        <div className="mb-4 flex flex-col items-center gap-3">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${urgent ? "bg-red-50 ring-4 ring-red-200" : "bg-amber-50 ring-4 ring-amber-200"}`}>
            <span className={`text-xl font-bold tabular-nums ${urgent ? "text-red-600" : "text-amber-600"}`}>
              {display}
            </span>
          </div>
          <h2 className="text-base font-semibold text-gray-900">
            Still there?
          </h2>
          <p className="text-center text-sm text-gray-500 leading-relaxed">
            You&apos;ve been inactive for a while. For your security, you&apos;ll be
            signed out automatically in{" "}
            <span className={`font-semibold ${urgent ? "text-red-600" : "text-amber-600"}`}>
              {display}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
          >
            Keep me signed in
          </button>
          <button
            type="button"
            onClick={onLogOutNow}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.round(WARN_BEFORE_MS / 1000))

  // Refs so callbacks never go stale
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loggingOutRef = useRef(false)

  const clearAllTimers = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const doSignOut = useCallback(() => {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    clearAllTimers()
    setShowWarning(false)
    clearClientCartOnly()
    void signOut({ callbackUrl: "/auth/login?reason=inactive" })
  }, [clearAllTimers])

  const startCountdown = useCallback(() => {
    setSecondsLeft(Math.round(WARN_BEFORE_MS / 1000))
    setShowWarning(true)

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    logoutTimerRef.current = setTimeout(() => {
      doSignOut()
    }, WARN_BEFORE_MS)
  }, [doSignOut])

  const resetTimer = useCallback(() => {
    if (loggingOutRef.current) return
    clearAllTimers()
    setShowWarning(false)

    warnTimerRef.current = setTimeout(() => {
      startCountdown()
    }, IDLE_MS - WARN_BEFORE_MS)
  }, [clearAllTimers, startCountdown])

  const handleStayLoggedIn = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    if (status !== "authenticated") {
      clearAllTimers()
      setShowWarning(false)
      return
    }

    resetTimer()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      clearAllTimers()
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [status, resetTimer, clearAllTimers])

  return (
    <>
      {children}
      {showWarning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStayLoggedIn={handleStayLoggedIn}
          onLogOutNow={doSignOut}
        />
      )}
    </>
  )
}