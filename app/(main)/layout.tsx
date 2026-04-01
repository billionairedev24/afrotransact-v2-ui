import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const _session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pb-[env(safe-area-inset-bottom,0px)] md:pb-0">
        {children}
      </main>
      <Footer />
    </div>
  )
}
