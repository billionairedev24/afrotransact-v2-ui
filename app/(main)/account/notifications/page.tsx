"use client"

import { AccountShell } from "@/components/account/AccountShell"
import { NotificationsSection } from "@/components/account/sections/NotificationsSection"

export default function NotificationsPage() {
  return (
    <AccountShell
      title="Notifications"
      subtitle="Choose which emails you want to receive. Changes save automatically."
    >
      <NotificationsSection />
    </AccountShell>
  )
}
