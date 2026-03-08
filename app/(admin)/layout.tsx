import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { AdminShell } from "@/components/admin/AdminShell"

/**
 * Server Component layout for the admin panel.
 *
 * Role check runs entirely on the server — only users with the "admin"
 * Keycloak realm role can reach these routes. Everyone else is redirected.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/admin")
  }

  const roles: string[] = session.user?.roles ?? []
  if (!roles.includes("admin")) {
    redirect("/")
  }

  return <AdminShell>{children}</AdminShell>
}
