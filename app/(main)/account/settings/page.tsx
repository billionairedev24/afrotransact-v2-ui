"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * The monolithic Settings page has been split into Profile, Login & Security,
 * and Notifications under /account. Redirect anyone landing on the old URL.
 *
 * Hash fragments from old links (e.g. `#notifications`) are translated to the
 * corresponding new page so existing bookmarks still land somewhere useful.
 */
export default function SettingsRedirect() {
  const router = useRouter()
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : ""
    switch (hash) {
      case "notifications":
        router.replace("/account/notifications")
        break
      case "security":
      case "danger":
      case "password":
        router.replace("/account/security")
        break
      case "profile":
        router.replace("/account/profile")
        break
      default:
        router.replace("/account")
    }
  }, [router])
  return null
}
