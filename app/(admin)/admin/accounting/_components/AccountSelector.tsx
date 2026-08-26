"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { AccountRef } from "@/lib/api"

export interface AccountSelectorProps {
  accounts: AccountRef[]
  value: string
  onChange: (id: string) => void
  loading?: boolean
}

type Option = {
  id: string
  label: string
  dotClassName: string | null
}

function optionsFrom(accounts: AccountRef[]): Option[] {
  const opts: Option[] = [{ id: "all", label: "All accounts", dotClassName: null }]

  const house = accounts.find((a) => a.kind === "house")
  opts.push({
    id: "house",
    label: house ? house.name : "House — AfroTransact",
    dotClassName: "bg-brand-gold",
  })

  const sellerDots = ["bg-violet-500", "bg-emerald-500", "bg-sky-500", "bg-rose-500", "bg-amber-500"]
  accounts
    .filter((a) => a.kind === "seller")
    .forEach((seller, i) => {
      opts.push({
        id: seller.id,
        label: seller.name,
        dotClassName: sellerDots[i % sellerDots.length],
      })
    })

  return opts
}

export function AccountSelector({ accounts, value, onChange, loading }: AccountSelectorProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const options = optionsFrom(accounts)
  const selected = options.find((o) => o.id === value) ?? options[0]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 min-w-[200px] items-center justify-between gap-2 rounded-xl border bg-card px-3 text-sm text-foreground shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-brand-gold" : "border-border hover:border-brand-gold/60",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selected.dotClassName && (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", selected.dotClassName)} />
          )}
          <span className="truncate">{loading ? "Loading accounts…" : selected.label}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-20 mt-1 max-h-72 w-full min-w-[220px] overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {options.map((opt) => {
            const active = opt.id === value
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-brand-gold/10 text-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    {opt.dotClassName && (
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dotClassName)} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-brand-gold" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
