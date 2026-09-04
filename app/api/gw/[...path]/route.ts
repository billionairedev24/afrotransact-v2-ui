import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Authenticated same-origin BFF proxy.
 *
 * The browser calls `/api/gw/<path>` with NO Authorization header; this handler
 * reads the Keycloak access token from the server-side session JWT (via
 * `getToken`, never exposed to the browser) and forwards the request to the
 * gateway with the token attached. This is the seam that lets us stop putting
 * `session.accessToken` on the client (see project_bff_token_exposure).
 *
 * Next 16: dynamic route `params` is a Promise — `await ctx.params`.
 */
function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  )
}

// Hop-by-hop / identity headers we must never forward. The client's own
// Authorization/Cookie are dropped — the token is (re)attached here server-side.
const STRIP = new Set([
  "host",
  "connection",
  "content-length",
  "authorization",
  "cookie",
  "transfer-encoding",
])

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params
  const suffix = "/" + (path ?? []).map(encodeURIComponent).join("/")
  const url = `${apiBase()}${suffix}${req.nextUrl.search}`

  const token = await getToken({ req })
  const accessToken = token?.accessToken as string | undefined

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!STRIP.has(key.toLowerCase())) headers.set(key, value)
  })
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`)

  const method = req.method.toUpperCase()
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer()

  let res: Response
  try {
    res = await fetch(url, { method, headers, body, cache: "no-store", redirect: "manual" })
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error(`[BFF] ${method} ${suffix} → upstream error`, err)
    }
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 })
  }

  // Stream the upstream body straight through (works for JSON and streaming
  // responses like the AI chat), copying only safe headers.
  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    if (!STRIP.has(key.toLowerCase())) outHeaders.set(key, value)
  })
  return new NextResponse(res.body, { status: res.status, headers: outHeaders })
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
}
