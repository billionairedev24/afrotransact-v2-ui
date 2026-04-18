import type { Metadata } from "next"
import DealsPageClient from "./DealsPageClient"

// Deals are revalidated every 60s — short enough that freshly-published
// promotions appear quickly, long enough that most shoppers hit the cache.
export const revalidate = 60

export const metadata: Metadata = {
  title: "Deals | AfroTransact",
  description:
    "Today's hottest deals from vetted African-owned sellers: discounted staples, new arrivals, and limited-time promotions.",
  openGraph: {
    title: "Deals | AfroTransact",
    description:
      "Today's hottest deals from vetted African-owned sellers.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Deals | AfroTransact",
    description:
      "Today's hottest deals from vetted African-owned sellers.",
  },
  alternates: { canonical: "/deals" },
}

export default function DealsPage() {
  return <DealsPageClient />
}
