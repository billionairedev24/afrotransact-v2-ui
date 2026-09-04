import "server-only"
import { cookies, headers } from "next/headers"
import { getToken } from "next-auth/jwt"

/**
 * Server-side Keycloak access token, read from the session JWT cookie — the
 * token never reaches the browser. Works in both Server Components (no `req`)
 * and Route Handlers. Same source the /api/gw proxy uses, so server-rendered
 * pages and the client's proxied calls stay consistent.
 *
 * secureCookie is derived from the request proto so the right cookie name is
 * used on localhost (http → `next-auth.session-token`) and prod
 * (https → `__Secure-next-auth.session-token`).
 */
export async function getServerAccessToken(): Promise<string | undefined> {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()])
  const proto = hdrs.get("x-forwarded-proto") ?? ""
  const secureCookie =
    proto === "https" || (process.env.NEXTAUTH_URL ?? "").startsWith("https://")
  const req = {
    headers: Object.fromEntries(hdrs.entries()),
    cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
  }
  const token = await getToken({
    req: req as never,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  })
  return (token?.accessToken as string | undefined) ?? undefined
}
