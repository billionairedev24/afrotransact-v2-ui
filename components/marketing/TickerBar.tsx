"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Promotion } from "@/components/marketing/PromoSlot"

/**
 * Announcement ticker — the "TICKER" placement. A thin bar under the navbar
 * that scrolls short marquee messages ("Free shipping", "48-hour doorstep
 * delivery", …), each an admin-managed, schedulable promotion whose title is
 * the message and optional ctaUrl links it. Text-only (no image).
 */
function isLiveNow(p: Promotion): boolean {
  if (!p.active) return false
  const now = Date.now()
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return false
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return false
  return true
}

function Message({ p }: { p: Promotion }) {
  const body = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-6">
      <span aria-hidden className="text-brand-gold-foreground/50">◆</span>
      <span className="font-semibold">{p.title}</span>
      {p.subtitle ? <span className="text-brand-gold-foreground/75">{p.subtitle}</span> : null}
    </span>
  )
  return p.ctaUrl ? (
    <Link href={p.ctaUrl} className="hover:underline underline-offset-2">
      {body}
    </Link>
  ) : (
    body
  )
}

export function TickerBar() {
  const [items, setItems] = useState<Promotion[]>([])
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/public/promotions?placement=TICKER", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { promotions?: Promotion[] }
        const live = (data.promotions ?? []).filter(isLiveNow).sort((a, b) => a.sortOrder - b.sortOrder)
        if (!cancelled) setItems(live)
      } catch {
        /* a ticker must never break the page */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (items.length === 0) return null

  // Reduced motion: no marquee — center the messages and let them scroll by hand.
  if (reduced) {
    return (
      <div className="w-full overflow-x-auto bg-brand-gold text-brand-gold-foreground border-b border-black/10">
        <div className="flex w-max min-w-full items-center justify-center py-2 text-[13px] leading-none">
          {items.map((p) => (
            <Message key={p.id} p={p} />
          ))}
        </div>
      </div>
    )
  }

  // Seamless marquee: render the set twice; translate by -50% = one full set.
  const duration = Math.max(18, items.length * 8)
  const track = (dup: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={dup}>
      {items.map((p) => (
        <Message key={(dup ? "b-" : "a-") + p.id} p={p} />
      ))}
    </div>
  )

  return (
    <div className="group relative w-full overflow-hidden bg-brand-gold text-brand-gold-foreground border-b border-black/10">
      <div
        className="atx-ticker flex w-max items-center py-2 text-[13px] leading-none"
        style={{ ["--atx-ticker-duration" as unknown as string]: `${duration}s` }}
      >
        {track(false)}
        {track(true)}
      </div>
      <style>{`
        @keyframes atx-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .atx-ticker { animation: atx-ticker-scroll var(--atx-ticker-duration, 30s) linear infinite; }
        .group:hover .atx-ticker { animation-play-state: paused; }
      `}</style>
    </div>
  )
}
