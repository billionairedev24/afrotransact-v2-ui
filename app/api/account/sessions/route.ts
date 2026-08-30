import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { listUserSessions } from "@/lib/keycloak-admin"
import { getLoginSessionDevices, type LoginSessionDeviceDto } from "@/lib/api"
import { lookupGeo, formatGeo } from "@/lib/geoip"
import { parseUserAgent } from "@/lib/user-agent"

export const dynamic = "force-dynamic"

/**
 * GET /api/account/sessions — the current user's active devices.
 *
 * Merges three sources: Keycloak's admin session list (authoritative IP +
 * timestamps + which sessions exist), our own captured device fingerprints
 * (user-agent per session id — Keycloak's admin API doesn't expose it), and a
 * best-effort GeoIP lookup on each IP. The session matching the token's `sid`
 * is flagged as the current device.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }
  const userId = (token.id as string | undefined) ?? (token.sub as string | undefined)
  const currentSid = (token.sid as string | undefined) ?? null
  const accessToken = token.accessToken as string | undefined
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 400 })
  }

  const [kcSessions, devices] = await Promise.all([
    listUserSessions(userId),
    accessToken
      ? getLoginSessionDevices(accessToken).catch(() => [] as LoginSessionDeviceDto[])
      : Promise.resolve([] as LoginSessionDeviceDto[]),
  ])

  const deviceBySid = new Map(devices.map((d) => [d.sessionId, d]))

  const sessions = await Promise.all(
    kcSessions.map(async (s) => {
      const geo = await lookupGeo(s.ipAddress)
      const ua = deviceBySid.get(s.id)?.userAgent ?? undefined
      const device = parseUserAgent(ua)
      return {
        id: s.id,
        current: currentSid != null && s.id === currentSid,
        device: {
          label: device.label,
          browser: device.browser,
          os: device.os,
          type: device.deviceType,
          known: !!ua,
        },
        ip: s.ipAddress ?? null,
        location: formatGeo(geo) || null,
        started: s.start ?? null,
        lastActive: s.lastAccess ?? null,
      }
    }),
  )

  // Current device first, then most-recently-active.
  sessions.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1
    return (b.lastActive ?? 0) - (a.lastActive ?? 0)
  })

  const lastLogin = sessions.reduce<number | null>((max, s) => {
    const t = s.started ?? s.lastActive
    return t != null && (max == null || t > max) ? t : max
  }, null)

  return NextResponse.json({ currentSessionId: currentSid, lastLogin, sessions })
}
