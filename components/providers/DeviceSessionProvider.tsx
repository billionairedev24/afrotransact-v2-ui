"use client"

/**
 * Captures the current browser's user-agent for the signed-in Keycloak session
 * so the account "active devices" view can label it ("Chrome on macOS").
 * Keycloak's admin session API returns IP + timestamps but not the user-agent,
 * so we record it ourselves, keyed by the session id (`sid`). Fires once per
 * session per tab. Renders nothing.
 */

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { pingLoginSession } from "@/lib/api"

export function DeviceSessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pingedForSid = useRef<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return
    const token = session?.accessToken as string | undefined
    const sid = session?.sid as string | undefined
    if (!token || !sid) return
    if (pingedForSid.current === sid) return
    pingedForSid.current = sid
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    void pingLoginSession(token, sid, ua).catch(() => {
      // Non-fatal — device just won't be labeled. Allow a retry on next change.
      pingedForSid.current = null
    })
  }, [status, session?.accessToken, session?.sid])

  return <>{children}</>
}
