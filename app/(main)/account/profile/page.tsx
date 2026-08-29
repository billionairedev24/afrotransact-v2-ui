"use client"

import { AccountShell } from "@/components/account/AccountShell"
import { ProfileSection } from "@/components/account/sections/ProfileSection"

export default function ProfilePage() {
  return (
    <AccountShell
      title="Profile"
      subtitle="Your personal information on file with AfroTransact."
    >
      <ProfileSection />
    </AccountShell>
  )
}
