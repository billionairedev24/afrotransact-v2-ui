"use client"

import { AccountShell } from "@/components/account/AccountShell"
import { PaymentsSection } from "@/components/account/sections/PaymentsSection"

export default function PaymentMethodsPage() {
  return (
    <AccountShell
      title="Payment Methods"
      subtitle="Cards you have saved at checkout. Tokenized by Stripe — we never store raw card numbers."
    >
      <PaymentsSection />
    </AccountShell>
  )
}
