/**
 * Canonical site origin — single source of truth for metadataBase, the sitemap,
 * robots, and any absolute-URL building. Defaults to the www host, which serves
 * 200 (the bare apex 308-redirects to it) and is the domain verified in Google
 * Search Console. Override per-environment with NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://www.afrotransact.com"
    : "http://localhost:3001")
).replace(/\/+$/, "")
