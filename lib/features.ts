/**
 * Server-controlled feature toggles.
 *
 * Three simple kill-switches that previously lived in
 * config.region_features and the /admin/feature-flags admin page. The
 * admin CRUD was YAGNI for three flags that almost never flip — they
 * now ship as NEXT_PUBLIC_* env vars baked at build time. To flip in
 * prod, change the Vercel env var and trigger a redeploy (or override
 * via `vercel env pull` for instant rollout).
 *
 * Default = true so a missing env var (e.g. local dev) keeps every
 * feature on.
 */
function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key]
  if (v === undefined || v === "") return fallback
  return v === "1" || v.toLowerCase() === "true"
}

export const features = {
  /** Buyer-facing reviews on the product detail page. */
  reviewsEnabled: () => envBool("NEXT_PUBLIC_FEATURE_REVIEWS_ENABLED", true),
  /** Master marketplace kill-switch. Search + checkout respect this. */
  marketplaceEnabled: () => envBool("NEXT_PUBLIC_FEATURE_MARKETPLACE_ENABLED", true),
  /** Stripe payment method offering at checkout. */
  stripeEnabled: () => envBool("NEXT_PUBLIC_FEATURE_STRIPE_ENABLED", true),
}
