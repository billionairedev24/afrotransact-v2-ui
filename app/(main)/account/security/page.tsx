"use client"

import { AccountShell } from "@/components/account/AccountShell"
import { SecuritySection } from "@/components/account/sections/SecuritySection"

export default function SecurityPage() {
  return (
    <AccountShell
      title="Login & Security"
      subtitle="Manage how you sign in and protect your account."
    >
      <SecuritySection />
    </AccountShell>
  )
}
