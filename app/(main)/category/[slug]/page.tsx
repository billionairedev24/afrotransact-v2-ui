import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCategories } from "@/lib/api"
import CategoryPageClient from "./CategoryPageClient"

// Categories barely change; ISR for 5 minutes means almost all traffic
// is served from the Next.js cache while still picking up edits quickly.
export const revalidate = 300

type Params = { slug: string }

function findCategoryName(cats: { slug: string; name: string; children?: unknown }[], slug: string): string | null {
  for (const c of cats as Array<{ slug: string; name: string; children?: { slug: string; name: string }[] }>) {
    if (c.slug === slug) return c.name
    if (c.children) {
      const name = findCategoryName(c.children, slug)
      if (name) return name
    }
  }
  return null
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  try {
    const categories = await getCategories({ revalidate: 300 })
    const name = findCategoryName(categories as unknown as { slug: string; name: string }[], slug) ?? slug
    const title = `${name} | AfroTransact`
    const description = `Browse ${name} products from vetted African-owned sellers on AfroTransact.`
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary", title, description },
      alternates: { canonical: `/category/${slug}` },
    }
  } catch {
    return { title: "Category | AfroTransact" }
  }
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  // Validate the slug server-side so an unknown category returns a real 404
  // instead of a soft-404 (empty client render served with a 200). On a
  // transient API error we don't 404 a possibly-valid page.
  let exists = true
  try {
    const categories = await getCategories({ revalidate: 300 })
    exists = findCategoryName(categories as unknown as { slug: string; name: string }[], slug) !== null
  } catch {
    exists = true
  }
  if (!exists) notFound()
  return <CategoryPageClient />
}
