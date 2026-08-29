"use client"

import { AccountShell } from "@/components/account/AccountShell"
import { AddressesSection } from "@/components/account/sections/AddressesSection"

export default function AddressesPage() {
  return (
    <AccountShell
      title="Your Addresses"
      subtitle="Add, edit, or set a default delivery address for checkout."
    >
      <AddressesSection />
    </AccountShell>
  )
}
