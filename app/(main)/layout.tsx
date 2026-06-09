import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

// WhatsAppFab is mounted in the ROOT app/layout.tsx (not here) so it also
// renders on app/page.tsx (homepage) which is outside this route group.
// The component self-hides on admin/seller/auth/onboarding paths.

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
