import { redirect } from "next/navigation"

/** Short transactional-email link → seller onboarding. */
export default function ShortOnboardingLink() {
  redirect("/dashboard/onboarding")
}
