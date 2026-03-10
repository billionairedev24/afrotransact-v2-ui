import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AfroTransact - Your Community Marketplace",
  description:
    "Connecting immigrant communities with fresh food, authentic products, and trusted local vendors. Shop from your community, support your neighbors.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/favicon.png",
  },
  openGraph: {
    title: "AfroTransact - Your Community Marketplace",
    description: "Authentic food, spices, fashion, and cultural goods from immigrant-owned stores.",
    images: [{ url: "/logo.png", width: 512, height: 512 }],
  },
  metadataBase: new URL(
    process.env.NODE_ENV === 'production'
      ? 'https://afrotransact.com'
      : 'http://localhost:3000'
  ),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
