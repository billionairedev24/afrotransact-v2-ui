import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to AfroTransact
          </Link>
          <nav className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/seller-agreement" className="hover:text-white transition-colors">Seller Agreement</Link>
          </nav>
        </div>
      </div>
      <main>{children}</main>
      <footer className="border-t border-border/50 mt-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} AfroTransact, LLC. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
