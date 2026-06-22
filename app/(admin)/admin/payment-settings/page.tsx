import { redirect } from "next/navigation"

export default function PaymentSettingsPage() {
  redirect("/admin/settings#payment")
}
