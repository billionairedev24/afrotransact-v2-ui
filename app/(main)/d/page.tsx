import { redirect } from "next/navigation"

/** Short transactional-email link → seller dashboard. */
export default function ShortDashboardLink() {
  redirect("/dashboard")
}
