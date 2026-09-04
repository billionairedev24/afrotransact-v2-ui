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
    // Token no longer needed client-side — the /api/gw proxy attaches it. Pass
    // the user id as a non-secret presence marker; only `sid` is required data.
    const uid = session?.user?.id as string | undefined
    const sid = session?.sid as string | undefined
    if (!uid || !sid) return
    if (pingedForSid.current === sid) return
    pingedForSid.current = sid
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    void pingLoginSession(uid, sid, ua).catch(() => {
      // Non-fatal — device just won't be labeled. Allow a retry on next change.
      pingedForSid.current = null
    })
  }, [status, session?.user?.id, session?.sid])

  return <>{children}</>
}
