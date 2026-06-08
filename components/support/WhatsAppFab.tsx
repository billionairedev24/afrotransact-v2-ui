"use client"

import { usePathname } from "next/navigation"
import { useState } from "react"

/**
 * Floating WhatsApp chat FAB.
 *
 * Reads NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER (E.164, e.g. "+15551234567").
 * Renders nothing if the env var is unset/blank so we never expose a broken link.
 * Hidden on /checkout to avoid competing with the purchase CTA.
 */
export function WhatsAppFab() {
  const pathname = usePathname()
  const [hovered, setHovered] = useState(false)

  const raw = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER?.trim()
  if (!raw) return null

  // Hide on checkout — FAB competes with the purchase CTA there.
  if (pathname?.startsWith("/checkout")) return null

  // wa.me expects digits only, no leading "+".
  const digits = raw.replace(/[^\d]/g, "")
  if (!digits) return null

  const prefill = encodeURIComponent("Hi AfroTransact, I need help with...")
  const href = `https://wa.me/${digits}?text=${prefill}`

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {hovered && (
        <span className="pointer-events-none rounded-md bg-black/80 px-2 py-1 text-xs font-medium text-white shadow-md">
          Chat with us
        </span>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with AfroTransact on WhatsApp"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366]"
        style={{ backgroundColor: "#25D366" }}
      >
        {/* Official WhatsApp speech-bubble glyph, inline (no third-party fetch). */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          width="24"
          height="24"
          fill="#FFFFFF"
          aria-hidden="true"
        >
          <path d="M16.003 3C9.382 3 4 8.382 4 15.003c0 2.64.86 5.21 2.49 7.34L4 29l6.84-2.43a12.02 12.02 0 0 0 5.16 1.18h.005C22.62 27.75 28 22.367 28 15.748 28 12.55 26.76 9.54 24.51 7.29 22.26 5.04 19.25 3.8 16.05 3.8l-.047-.8zm0 2.4h.04c2.62 0 5.07 1.02 6.92 2.87a9.66 9.66 0 0 1 2.86 6.88c0 5.4-4.39 9.795-9.78 9.795a9.75 9.75 0 0 1-4.66-1.19l-.33-.2-4.06 1.44 1.45-3.96-.22-.34a9.66 9.66 0 0 1-1.5-5.16c0-5.4 4.39-9.79 9.78-9.79zm-5.49 5.51c-.2 0-.52.07-.79.36-.27.29-1.04 1.01-1.04 2.47 0 1.46 1.07 2.87 1.22 3.07.15.2 2.07 3.32 5.13 4.52 2.55 1 3.07.8 3.62.75.55-.05 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.55-.34-.29-.15-1.73-.86-2-.96-.27-.1-.46-.15-.66.15-.2.29-.76.96-.93 1.16-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.45-.86-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.58-.9-2.17-.24-.57-.49-.5-.66-.5l-.56-.01z" />
        </svg>
      </a>
    </div>
  )
}

export default WhatsAppFab
