import type { Metadata } from "next"
import { getProductBySlug } from "@/lib/api"
import ProductPageClient from "./ProductPageClient"

// Product pages benefit from ISR: the detail is SEO-critical but rarely
// changes. We revalidate every 60s so inventory/price updates propagate
// without hammering the catalog service on every request.
export const revalidate = 60

type Params = { slug: string }

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  try {
    const product = await getProductBySlug(slug, { revalidate: 60 })
    const image = product.images?.[0]?.url
    return {
      title: `${product.title} | AfroTransact`,
      description: product.description?.slice(0, 160) ?? product.title,
      openGraph: {
        title: product.title,
        description: product.description?.slice(0, 200) ?? product.title,
        images: image ? [{ url: image }] : undefined,
        type: "website",
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: product.title,
        description: product.description?.slice(0, 160) ?? product.title,
        images: image ? [image] : undefined,
      },
      alternates: { canonical: `/product/${slug}` },
    }
  } catch {
    return { title: "Product | AfroTransact" }
  }
}

export default function ProductPage() {
  return <ProductPageClient />
}
