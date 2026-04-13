import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { AiWidget } from "@/components/ai/AiWidget"

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
      <AiWidget />
    </div>
  )
}
