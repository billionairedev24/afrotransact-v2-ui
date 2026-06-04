import { redirect } from "next/navigation"

type Params = Promise<{ orderNumber: string }>

/**
 * Short transactional-email link → canonical order detail.
 * Emails use /o/{orderNumber} instead of /orders/{orderNumber} to keep URLs compact.
 */
export default async function ShortOrderLink({ params }: { params: Params }) {
  const { orderNumber: raw } = await params
  const orderNumber = decodeURIComponent(raw ?? "").trim()
  if (!orderNumber || orderNumber.includes("/") || orderNumber.includes("..")) {
    redirect("/orders")
  }
  redirect(`/orders/${orderNumber}`)
}
