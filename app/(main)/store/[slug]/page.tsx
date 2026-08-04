import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getStoreBySlug } from "@/lib/api"
import StorePageClient from "./StorePageClient"

// Storefront profile changes infrequently (name, logo, location), but
// freshly-approved products need to surface fast — 30s ISR is the sweet
// spot for "smooth in prod without a 3-minute stale window after admin
// approval". Products themselves load client-side and are uncached.
export const revalidate = 30

type Params = { slug: string }

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  try {
    const store = await getStoreBySlug(slug, { revalidate: 180 })
    const title = `${store.name} | AfroTransact`
    const description = store.description
      ? store.description.slice(0, 160)
      : `Shop authentic African products from ${store.name} on AfroTransact.`
    const ogImage = store.bannerUrl ?? store.logoUrl ?? undefined
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: ogImage ? [{ url: ogImage }] : undefined,
        type: "website",
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title,
        description,
        images: ogImage ? [ogImage] : undefined,
      },
      alternates: { canonical: `/store/${slug}` },
    }
  } catch {
    return { title: "Store | AfroTransact" }
  }
}

export default async function StorePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  // Validate server-side so an unknown store returns a real 404 instead of a
  // soft-404 (empty client render served with a 200). Only a genuine 404 is
  // treated as not-found; a transient error falls through to the client.
  let notFoundStore = false
  try {
    await getStoreBySlug(slug, { revalidate: 180 })
  } catch (err) {
    // Direct status check — `instanceof ApiError` is unreliable across the RSC
    // module boundary. Only a genuine 404 is treated as not-found.
    if ((err as { status?: number } | null)?.status === 404) notFoundStore = true
  }
  if (notFoundStore) notFound()
  return <StorePageClient />
}
