import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "Account Settings | AfroTransact" }

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login?callbackUrl=/account/settings")
  }

  return (
    <main className="mx-auto max-w-[640px] px-4 sm:px-6 py-8">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Account
      </Link>

      <h1 className="text-2xl font-bold text-white mb-6">Account Settings</h1>

      <div className="space-y-4">
        <SettingRow label="Name" value={session.user?.name ?? "—"} />
        <SettingRow label="Email" value={session.user?.email ?? "—"} />
        <SettingRow
          label="Password"
          value="••••••••"
          note="Managed through Keycloak. Click to change."
          href={`${process.env.KEYCLOAK_ISSUER ?? "http://localhost:8180/realms/afrotransact"}/account/#/security/signingin`}
        />
        <SettingRow
          label="Roles"
          value={session.user?.roles?.join(", ") || "buyer"}
        />
      </div>
    </main>
  )
}

function SettingRow({
  label,
  value,
  note,
  href,
}: {
  label: string
  value: string
  note?: string
  href?: string
}) {
  const Wrapper = href ? "a" : "div"
  return (
    <Wrapper
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex items-center justify-between rounded-xl border border-white/10 px-5 py-4 hover:border-white/20 transition-colors"
      style={{ background: "hsl(0 0% 11%)" }}
    >
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-white mt-0.5">{value}</p>
        {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
      </div>
      {href && (
        <span className="text-xs text-primary font-medium">Change</span>
      )}
    </Wrapper>
  )
}
