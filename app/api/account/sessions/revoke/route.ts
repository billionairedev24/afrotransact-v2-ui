import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { listUserSessions, deleteUserSession, type KcUserSession } from "@/lib/keycloak-admin"

export const dynamic = "force-dynamic"

/**
 * POST /api/account/sessions/revoke — sign out one device or "everywhere else".
 *
 * Body: { sessionId: string }  → revoke that one session.
 *       { allExceptCurrent: true } → revoke every session except the caller's.
 *
 * The target session id(s) are always intersected with the caller's OWN active
 * sessions (from the admin API) before revoking, so a user can never revoke a
 * session that isn't theirs even by guessing an id.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }
  const userId = (token.id as string | undefined) ?? (token.sub as string | undefined)
  const currentSid = (token.sid as string | undefined) ?? null
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 400 })
  }

  let body: { sessionId?: string; allExceptCurrent?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const sessions = await listUserSessions(userId)
  const byId = new Map(sessions.map((s) => [s.id, s]))

  let targets: KcUserSession[] = []
  if (body.allExceptCurrent) {
    targets = sessions.filter((s) => s.id !== currentSid)
  } else if (body.sessionId) {
    const s = byId.get(body.sessionId)
    if (!s) {
      return NextResponse.json({ error: "not_your_session" }, { status: 403 })
    }
    targets = [s]
  } else {
    return NextResponse.json({ error: "nothing_to_revoke" }, { status: 400 })
  }

  const results = await Promise.all(targets.map((s) => deleteUserSession(s.id, s.offline)))
  const revoked = results.filter(Boolean).length
  return NextResponse.json({ ok: true, revoked, requested: targets.length })
}
