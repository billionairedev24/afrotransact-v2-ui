import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { OnboardingHeader } from "./OnboardingHeader"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/dashboard/onboarding")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingHeader userName={session.user?.name ?? session.user?.email ?? ""} />
      {children}
    </div>
  )
}
