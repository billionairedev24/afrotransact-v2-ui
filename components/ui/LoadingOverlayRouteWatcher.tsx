"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useLoadingOverlayStore } from "@/stores/loading-overlay-store"

/**
 * Anti-stuck mechanism for the global loading overlay. `show()` is fired
 * ahead of a navigation (e.g. before `signIn()` or `router.push()`); nothing
 * guarantees the destination will call `hide()` itself, so this component is
 * the single source of truth for clearing it.
 *
 * Per the Next.js docs (app/api-reference/functions/use-search-params +
 * app/guides/instant-navigation): `usePathname`/`useSearchParams` still
 * update on every completed client-side navigation in this fork, and
 * `useSearchParams` resolves synchronously on client navigations (only
 * page-load/prerendering needs the Suspense boundary) — so "the URL changed"
 * remains a reliable "navigation finished" signal. We still wrap the part
 * that calls useSearchParams in <Suspense> because production static
 * rendering requires it.
 *
 * Two extra safety nets guard the cases a URL change can't cover:
 * - `pageshow` (fires on bfcache restores, e.g. browser back after signIn()
 *   navigated away) — the overlay could otherwise survive a back-navigation
 *   into a cached page.
 * - `visibilitychange` to "visible" — covers an OAuth redirect that returns
 *   in the same tab, or any case a listener above is missed.
 */
function HideOnUrlChange() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hide = useLoadingOverlayStore((s) => s.hide)

  useEffect(() => {
    hide()
    // Re-run whenever the resolved URL (path or query) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()])

  return null
}

export function LoadingOverlayRouteWatcher() {
  const hide = useLoadingOverlayStore((s) => s.hide)

  useEffect(() => {
    const hideIfStale = () => hide()
    const hideOnVisible = () => {
      if (document.visibilityState === "visible") hide()
    }

    window.addEventListener("pageshow", hideIfStale)
    document.addEventListener("visibilitychange", hideOnVisible)

    return () => {
      window.removeEventListener("pageshow", hideIfStale)
      document.removeEventListener("visibilitychange", hideOnVisible)
    }
  }, [hide])

  return (
    <Suspense fallback={null}>
      <HideOnUrlChange />
    </Suspense>
  )
}
