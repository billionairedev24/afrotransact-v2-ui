"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { useAiStore } from "@/stores/ai-store"
import { AiChatPanel } from "./AiChatPanel"

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true"

/* Animated Afrobi logo button */
function AfrobiBadge({ unread, onClick }: { unread: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open Afrobi AI assistant"
      className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {/* Afrobi "A" mark */}
      <span className="text-primary-foreground text-xl font-black select-none leading-none">A</span>

      {/* Pulse ring — draws attention on first load */}
      <span className="absolute inset-0 rounded-full bg-primary opacity-20 animate-ping" />

      {/* Unread dot */}
      {unread && (
        <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-background" />
      )}
    </button>
  )
}

export function AiWidget() {
  const { isOpen, open, close, messages } = useAiStore()
  const [hasSeenOpen, setHasSeenOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mark as seen when opened
  useEffect(() => {
    if (isOpen) setHasSeenOpen(true)
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpen, close])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [isOpen, close])

  if (!AI_ENABLED) return null

  const unread = !hasSeenOpen && messages.length > 0

  return (
    <>
      {/* Chat panel — slides up from bottom-right */}
      <div
        ref={panelRef}
        className={`fixed bottom-[84px] right-4 z-50 w-[calc(100vw-2rem)] sm:w-[400px] transition-all duration-300 origin-bottom-right ${
          isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{ maxHeight: "min(600px, calc(100vh - 120px))" }}
        aria-hidden={!isOpen}
      >
        <AiChatPanel />
      </div>

      {/* FAB trigger */}
      <div className="fixed bottom-6 right-4 z-50">
        {isOpen ? (
          <button
            onClick={close}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:scale-105 active:scale-95 transition-transform duration-200"
            aria-label="Close Afrobi"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <AfrobiBadge unread={unread} onClick={open} />
        )}
      </div>
    </>
  )
}
