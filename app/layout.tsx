import type { Metadata } from "next"
import { Inter, Fraunces } from "next/font/google"
import { Providers } from "@/components/providers"
import { AiChatOverlay } from "@/components/ai/AiWidget"
import { WhatsAppFab } from "@/components/support/WhatsAppFab"
import { Toaster } from "sonner"
import "./globals.css"

// Body / UI voice.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
// Display voice — a warm optical serif used with restraint for headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "AfroTransact - Your Community Marketplace",
  description:
    "Connecting immigrant communities with fresh food, authentic products, and trusted local vendors. Shop from your community, support your neighbors.",
  // Favicons are served via the Next App Router file conventions
  // (app/favicon.ico, app/icon.svg, app/apple-icon.png) — no explicit
  // `icons` metadata needed.
  openGraph: {
    title: "AfroTransact - Your Community Marketplace",
    description: "Authentic food, spices, fashion, and cultural goods from immigrant-owned stores.",
    images: [{ url: "/brand/email-logo.png", width: 600, height: 183 }],
  },
  // Google Merchant Center / Search Console site verification. Renders
  // <meta name="google-site-verification" content="…"> into <head> on every
  // page (incl. the home page Google fetches to verify the store).
  verification: {
    google: "J8ES2z6EgHkohYBiaDFrY9zUP8e5y-YLgkQXHnniYHg",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://afrotransact.com'
        : 'http://localhost:3001')
  ),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} font-sans bg-background text-foreground antialiased`}>
        <Providers>
          {children}
          <AiChatOverlay />
          <WhatsAppFab />
          <Toaster position="bottom-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  )
}
