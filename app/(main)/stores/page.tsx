import { redirect } from "next/navigation"

// Buyer-facing store browsing is intentionally hidden for the closed beta.
// Any existing bookmark or external link to /stores lands on the homepage
// instead of a "Top Stores" listing. Sellers and admins still access their
// own store via the dashboard "Preview Storefront" link
// (/store/[slug]?preview=1), so /store/[slug] itself is NOT redirected.
export default function StoresPage(): never {
  redirect("/")
}
