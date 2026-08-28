"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLoadingOverlayStore } from "@/stores/loading-overlay-store"

/**
 * Wraps next/navigation's router.push with the global loading overlay:
 * shows immediate feedback before kicking off a navigation that may take a
 * moment (e.g. a product page that isn't prefetched). The overlay clears
 * itself once the URL updates — see LoadingOverlayRouteWatcher — so callers
 * never need to call hide() themselves.
 *
 * Establishes the pattern; not applied everywhere. See rollout note in the
 * implementation report for how to adopt it elsewhere.
 */
export function useOverlayNavigate() {
  const router = useRouter()
  const show = useLoadingOverlayStore((s) => s.show)

  return useCallback(
    (href: string, label?: string) => {
      show(label)
      router.push(href)
    },
    [router, show]
  )
}
