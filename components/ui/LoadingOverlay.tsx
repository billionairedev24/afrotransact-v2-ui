"use client"

import { Loader2 } from "lucide-react"
import { useLoadingOverlayStore } from "@/stores/loading-overlay-store"
import { LoadingOverlayRouteWatcher } from "@/components/ui/LoadingOverlayRouteWatcher"

/**
 * Global full-screen loading overlay. Mounted exactly once, in
 * components/providers.tsx, and toggled via useLoadingOverlayStore so any
 * client component (sign-in buttons, slow navigations) can trigger it
 * without prop-drilling.
 *
 * Renders null when hidden — no DOM, no layout cost, on every other page.
 */
export function LoadingOverlay() {
  const visible = useLoadingOverlayStore((s) => s.visible)
  const label = useLoadingOverlayStore((s) => s.label)

  return (
    <>
      {/* Always mounted (even while hidden) so it can watch for navigation
          completion and clear a stale overlay — see the anti-stuck note in
          the store. */}
      <LoadingOverlayRouteWatcher />
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm font-sans"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card/90 px-8 py-6 shadow-xl">
            <Loader2
              className="h-8 w-8 text-brand-gold motion-safe:animate-spin"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-foreground">{label ?? "Loading…"}</p>
            <span className="sr-only">Loading…</span>
          </div>
        </div>
      )}
    </>
  )
}
