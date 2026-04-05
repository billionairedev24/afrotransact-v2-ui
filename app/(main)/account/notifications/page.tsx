"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Notifications are now managed inline on the Account Settings page.
 * Redirect anyone landing here directly.
 */
export default function NotificationsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/account/settings#notifications")
  }, [router])
  return null
}
