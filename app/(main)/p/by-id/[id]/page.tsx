import { redirect } from "next/navigation"
import { getCatalogItemPublic } from "@/lib/api"

/**
 * Phase 9.6b — buyer search results link to /p/by-id/{catalog_item_id}
 * because ES today only carries the offer slug, not the catalog item
 * slug. This route resolves the id → catalog item slug and 308s to
 * /p/{slug}. Cheap server lookup; cacheable.
 *
 * When we index `catalog_item_slug` separately (follow-up), search can
 * link directly to /p/[slug] and this route becomes unused.
 */
export const dynamic = "force-static"
export const revalidate = 60

type Params = { id: string }

export default async function CatalogItemByIdRedirect({
  params,
}: {
  params: Promise<Params>
}) {
  const { id } = await params
  try {
    const item = await getCatalogItemPublic(id)
    redirect(`/p/${item.slug}`)
  } catch {
    redirect("/")
  }
}
