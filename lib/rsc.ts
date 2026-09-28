import { headers } from "next/headers"

/**
 * True when this render is serving a client-side router navigation (an RSC
 * payload request) rather than an initial document request.
 *
 * Pages that server-render a first data page use this to seed ONLY the initial
 * HTML. On a client navigation the already-mounted client component reads the
 * new searchParams and fetches immediately — before the RSC response arrives —
 * so seeding there just issues a second upstream request whose result is
 * thrown away.
 *
 * Detection is by `Sec-Fetch-Dest`: a browser sends `document` for a real page
 * load and `empty` for the router's fetch. Next strips the `RSC: 1` header and
 * the `_rsc=` query param before a page renders, so neither is usable here;
 * `accept: text/x-component` only shows up on server-issued RSC fetches.
 *
 * A request with no `Sec-Fetch-Dest` at all (crawlers, curl, older clients) is
 * treated as a document — those are exactly the callers that need the seeded
 * HTML most.
 */
export async function isRouterNavigation(): Promise<boolean> {
  try {
    const h = await headers()
    const dest = h.get("sec-fetch-dest")
    if (dest) return dest !== "document"
    return (h.get("accept") ?? "").includes("text/x-component")
  } catch {
    return false
  }
}
