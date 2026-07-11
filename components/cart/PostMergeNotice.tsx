"use client"

/**
 * Renders a one-time yellow info banner when the buyer's guest cart was just
 * merged into their account on sign-in. Defensive UX for shared computers —
 * makes it obvious that items now in the cart came from a prior browsing
 * session, with a one-click "clear them" escape hatch.
 *
 * Only shown:
 *   - on the /cart route
 *   - within 10 minutes of the merge happening
 *   - once (flag cleared on render OR on dismiss)
 *
 * Flag is written by components/providers/CartMergeProvider.tsx under the
 * sessionStorage key `at:cart:merge-notice`.
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { useCartStore } from "@/stores/cart-store"

const NOTICE_KEY = "at:cart:merge-notice"
const NOTICE_MAX_AGE_MS = 10 * 60 * 1000

interface NoticePayload {
  at: number
  count: number
}

function readNotice(): NoticePayload | null {
  try {
    const raw = sessionStorage.getItem(NOTICE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as NoticePayload).at === "number" &&
      typeof (parsed as NoticePayload).count === "number"
    ) {
      return parsed as NoticePayload
    }
  } catch {
    // corrupted — ignore
  }
  return null
}

function clearNotice(): void {
  try {
    sessionStorage.removeItem(NOTICE_KEY)
  } catch {
    // non-critical
  }
}

export function PostMergeNotice() {
  const pathname = usePathname()
  const [notice, setNotice] = useState<NoticePayload | null>(null)

  useEffect(() => {
    if (pathname !== "/cart") return
    const n = readNotice()
    if (!n) return
    if (Date.now() - n.at > NOTICE_MAX_AGE_MS) {
      clearNotice()
      return
    }
    setNotice(n)
    // One-shot: clear the flag as soon as we've shown it.
    clearNotice()
  }, [pathname])

  if (!notice || pathname !== "/cart") return null

  const handleClearItems = () => {
    useCartStore.getState().clearCart()
    setNotice(null)
  }

  const handleDismiss = () => {
    setNotice(null)
  }

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900"
    >
      <div className="flex-1 leading-snug">
        We added {notice.count} item{notice.count === 1 ? "" : "s"} from your
        previous browsing session — review them below before checking out.{" "}
        <button
          type="button"
          onClick={handleClearItems}
          className="font-semibold underline underline-offset-2 hover:text-yellow-950"
        >
          Clear them
        </button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notice"
        className="shrink-0 rounded-md p-1 text-yellow-900/70 hover:bg-yellow-100 hover:text-yellow-950 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
