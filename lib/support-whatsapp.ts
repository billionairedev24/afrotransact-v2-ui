/**
 * Buyer-support WhatsApp — single source of truth for the number + link
 * construction. Both the floating FAB and any inline "chat about shipping"
 * affordance (search / product cards flagged beyond_ship_limit) share this
 * helper so a future env change never causes drift.
 *
 * Reads NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER (E.164, e.g. "+15551234567").
 * Falls back to the AfroTransact production number so the affordance is
 * always live even before the env var is wired in a given environment.
 */
const DEFAULT_WHATSAPP_NUMBER = "+15125088885"

export function supportWhatsAppDigits(): string | null {
  const raw = (process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER?.trim() || DEFAULT_WHATSAPP_NUMBER)
  const digits = raw.replace(/[^\d]/g, "")
  return digits || null
}

export function supportWhatsAppLink(prefill?: string): string | null {
  const digits = supportWhatsAppDigits()
  if (!digits) return null
  const message = prefill?.trim() || "Hi AfroTransact, I need help with..."
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
