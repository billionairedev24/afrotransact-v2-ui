import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PromoSlot } from "@/components/marketing/PromoSlot"
import { PromoPopupModal } from "@/components/marketing/PromoPopupModal"
import { TickerBar } from "@/components/marketing/TickerBar"
import { GeoGate } from "@/components/geo/GeoGate"

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
      <TickerBar />
      <main className="flex-1 pb-[env(safe-area-inset-bottom,0px)] md:pb-0">
        <GeoGate>{children}</GeoGate>
      </main>
      <PromoSlot placement="FOOTER" className="mx-4 md:mx-6 lg:mx-8 mb-6" />
      <Footer />
      <PromoPopupModal />
    </div>
  )
}
