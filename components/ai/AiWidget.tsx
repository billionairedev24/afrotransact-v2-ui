"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, X } from "lucide-react"
import { useAiStore } from "@/stores/ai-store"
import { AiChatPanel } from "./AiChatPanel"

// Gated off for beta. Set NEXT_PUBLIC_AI_ENABLED=true to surface the assistant
// (both the navbar trigger AND the slide-out chat panel are hidden when false).
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true"

/**
 * Compact AI trigger styled to sit in the marketplace navbar next to the
 * Cart / Account icons (Amazon "Rufus" pattern). Renders nothing when AI is
 * gated off so the navbar stays clean and the WhatsApp FAB owns the
 * floating bottom-right slot.
 */
export function AiNavButton() {
  const { isOpen, open, close, messages } = useAiStore()
  const [hasSeenOpen, setHasSeenOpen] = useState(false)

  useEffect(() => {
    if (isOpen) setHasSeenOpen(true)
  }, [isOpen])

  if (!AI_ENABLED) return null

  const unread = !hasSeenOpen && messages.length > 0

  return (
    <button
      onClick={isOpen ? close : open}
      aria-label={isOpen ? "Close AfroTransact AI assistant" : "Open AfroTransact AI assistant"}
      aria-expanded={isOpen}
      className="flex flex-col items-center justify-center text-white hover:text-brand-gold-hover transition-colors shrink-0"
    >
      <div className="relative">
        {isOpen ? (
          <X className="h-6 w-6" strokeWidth={1.75} />
        ) : (
          <Sparkles className="h-6 w-6" strokeWidth={1.75} />
        )}
        {!isOpen && unread && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-brand-dark" />
        )}
      </div>
      <span className="text-[12px] font-semibold tracking-[0.02em] leading-none mt-0.5">
        AI
      </span>
    </button>
  )
}

/**
 * Slide-out chat panel, mounted once at the root layout. Listens to the same
 * shared store as AiNavButton — clicking the navbar trigger toggles `isOpen`,
 * the panel reflects it. Anchored top-right (no longer competes with the
 * bottom-right floating WhatsApp FAB).
 */
export function AiChatOverlay() {
  const { isOpen, close } = useAiStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Outside-click closes the panel.
  useEffect(() => {
    if (!isOpen) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpen, close])

  // ESC closes the panel.
  useEffect(() => {
    if (!isOpen) return
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [isOpen, close])

  // When the panel closes, move focus out of it first. Without this, a focused
  // descendant (e.g. the chat input) remains focused inside an `inert` container,
  // which the browser refuses and logs as an accessibility violation.
  useEffect(() => {
    if (isOpen) return
    const active = document.activeElement as HTMLElement | null
    if (active && panelRef.current?.contains(active)) {
      active.blur()
    }
  }, [isOpen])

  if (!AI_ENABLED) return null

  return (
    <div
      ref={panelRef}
      // Top-right anchor (under the header). Slides down from the AI nav
      // button. Bottom-right is owned by the WhatsApp FAB.
      className={`fixed top-[80px] right-4 z-50 w-[calc(100vw-2rem)] sm:w-[420px] transition-all duration-300 origin-top-right ${
        isOpen
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-95 pointer-events-none"
      }`}
      style={{ height: "min(660px, calc(100vh - 96px))" }}
      inert={!isOpen}
    >
      <AiChatPanel />
    </div>
  )
}

/**
 * @deprecated Use {@link AiNavButton} in the navbar and {@link AiChatOverlay}
 * once at the root layout instead. Kept as a thin alias so older imports keep
 * working until we mop them up.
 */
export const AiWidget = AiChatOverlay
