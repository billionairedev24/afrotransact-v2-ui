import { create } from "zustand"

/**
 * Global full-screen loading overlay — shown for the brief window between a
 * user action (sign-in redirect, a slow client navigation) and the browser
 * actually leaving/updating the page. Deliberately NOT persisted: it must
 * always start hidden on a fresh load.
 *
 * Anti-stuck contract: nothing that calls `show()` may rely on this store
 * alone to hide itself — see components/ui/LoadingOverlayRouteWatcher.tsx,
 * which force-hides on pathname/search-param change, bfcache restore
 * (`pageshow`), and tab re-focus (`visibilitychange`).
 */
interface LoadingOverlayState {
  visible: boolean
  label?: string
  show: (label?: string) => void
  hide: () => void
}

export const useLoadingOverlayStore = create<LoadingOverlayState>()((set) => ({
  visible: false,
  label: undefined,

  show: (label) => set({ visible: true, label }),

  hide: () => set({ visible: false, label: undefined }),
}))
