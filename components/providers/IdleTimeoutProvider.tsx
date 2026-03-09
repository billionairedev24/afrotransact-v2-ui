"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useSession, signOut } from "next-auth/react"

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const WARNING_BEFORE_MS = 2 * 60 * 1000
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (signoutTimerRef.current) clearTimeout(signoutTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    warningTimerRef.current = null
    signoutTimerRef.current = null
    countdownRef.current = null
  }, [])

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false)
    clearTimers()
    resetTimer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers])

  function resetTimer() {
    clearTimers()
    setShowWarning(false)

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      const secondsLeft = Math.floor(WARNING_BEFORE_MS / 1000)
      setCountdown(secondsLeft)

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      signoutTimerRef.current = setTimeout(() => {
        setShowWarning(false)
        signOut({ callbackUrl: "/auth/login?reason=idle" })
      }, WARNING_BEFORE_MS)
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)
  }

  useEffect(() => {
    if (status !== "authenticated") return

    resetTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      clearTimers()
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
            style={{ background: "hsl(0 0% 9%)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Session timeout</h2>
            </div>

            <p className="text-sm text-gray-400 mb-2">
              You will be signed out due to inactivity.
            </p>
            <p className="text-2xl font-mono font-bold text-amber-400 text-center my-4">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleStayLoggedIn}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
              >
                Stay logged in
              </button>
              <button
                onClick={() => {
                  setShowWarning(false)
                  signOut({ callbackUrl: "/auth/login?reason=idle" })
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-gray-400 transition-all hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
