import type { Metadata, Viewport } from "next"
import { Inter, Fraunces } from "next/font/google"
import { Providers } from "@/components/providers"
import { AiChatOverlay } from "@/components/ai/AiWidget"
import { WhatsAppFab } from "@/components/support/WhatsAppFab"
import { Toaster } from "sonner"
import { SITE_URL } from "@/lib/site"
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

// Light only — never render the OS dark theme. Emits <meta name="color-scheme"
// content="light"> so the browser paints UA surfaces light on dark-OS devices.
export const viewport: Viewport = {
  colorScheme: "light",
}

export const metadata: Metadata = {
  title: "AfroTransact - Your Community Marketplace",
  description:
    "Connecting immigrant communities with fresh food, authentic products, and trusted local vendors. Shop from your community, support your neighbors.",
  // Favicons are served via the Next App Router file conventions
  // (app/favicon.ico [16/32/48/64], app/icon.png [512], app/apple-icon.png
  // [180]) — the AfroTransact bag mark centered on a black tile. No explicit
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
  metadataBase: new URL(SITE_URL),
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
