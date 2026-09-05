"use client"

/**
 * Settings subtree layout. Every settings *sub-page* (referral, pickup,
 * store-shipping, waitlist, zones, …) gets a "Back to settings" link so admins
 * can return to the settings hub without hunting through the sidebar. The link
 * is hidden on the settings index itself.
 */

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { usePathname } from "next/navigation"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const onIndex = pathname === "/admin/settings" || pathname === "/admin/settings/"

  return (
    <div>
      {!onIndex && (
        <Link
          href="/admin/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>
      )}
      {children}
    </div>
  )
}
