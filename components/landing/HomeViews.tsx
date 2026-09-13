"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Customer-controlled view switcher for the homepage.
 *
 * Stage one of making the homepage stop being one fixed page that every visitor
 * sees forever. This is the version with no data dependency: the customer picks
 * the lens explicitly, so nothing is hidden behind a guess about who they are.
 * Rotating editorial and personalisation come later and can layer on top —
 * they change which view is DEFAULT, not whether the customer can still choose.
 *
 * Two deliberate decisions:
 *
 * 1. The hero and category rail stay outside this component. Swapping the whole
 *    page on a tap makes the site feel like four different sites; keeping the
 *    identity fixed and varying the merchandising below it is what makes the
 *    switch feel like a lens rather than a navigation event.
 *
 * 2. The choice is remembered. A returning visitor who always shops deals should
 *    land on deals — that is the cheapest possible personalisation and it needs
 *    no model, no history, and no privacy trade. It reads the stored value AFTER
 *    mount rather than during render, because server and client must agree on
 *    the first paint or React will complain about a hydration mismatch.
 *
 * Panels are rendered server-side and passed in as nodes, so switching costs no
 * network round trip and no client-side data fetching.
 */

export interface HomeView {
  id: string
  label: string
}

const STORAGE_KEY = "afrotransact:home-view"

export function HomeViews({
  views,
  panels,
  className,
}: {
  views: HomeView[]
  panels: Record<string, ReactNode>
  className?: string
}) {
  const [active, setActive] = useState(views[0]?.id ?? "")

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved && views.some((v) => v.id === saved)) setActive(saved)
    } catch {
      // Private mode or storage disabled — the default view is a fine outcome,
      // and this must never be the reason a homepage fails to render.
    }
  }, [views])

  const choose = (id: string) => {
    setActive(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* not worth surfacing */
    }
  }

  if (views.length === 0) return null

  return (
    <div className={className}>
      <div className="max-w-page mx-auto px-4 sm:px-5">
        <div
          role="tablist"
          aria-label="Browse the homepage by"
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {views.map((v) => {
            const on = v.id === active
            return (
              <button
                key={v.id}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`home-panel-${v.id}`}
                onClick={() => choose(v.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
                  on
                    ? "border-brand-dark bg-brand-dark text-brand-dark-foreground"
                    : "border-input bg-background text-foreground hover:border-brand-green/50",
                )}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Every panel is rendered; only the active one is shown. Keeping them in
          the DOM means switching is instant and — more importantly — the
          content is present for crawlers and for anyone without JavaScript,
          who would otherwise see a homepage with nothing under the hero. */}
      {views.map((v) => (
        <div
          key={v.id}
          id={`home-panel-${v.id}`}
          role="tabpanel"
          hidden={v.id !== active}
          className={cn("space-y-10", v.id === active ? "mt-8" : "")}
        >
          {panels[v.id]}
        </div>
      ))}
    </div>
  )
}
