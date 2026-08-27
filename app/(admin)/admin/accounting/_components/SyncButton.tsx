"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SyncButtonProps {
  onSync: () => void | Promise<void>
  syncing?: boolean
  lastSyncedAt?: Date | null
}

function relativeTime(from: Date, now: number): string {
  const diffMs = now - from.getTime()
  const diffSec = Math.max(0, Math.round(diffMs / 1000))
  if (diffSec < 45) return "just now"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export function SyncButton({ onSync, syncing, lastSyncedAt }: SyncButtonProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lastSyncedAt) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [lastSyncedAt])

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void onSync()}
        disabled={syncing}
        className={cn(
          "flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-brand-gold/60 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
        {syncing ? "Syncing…" : "Sync"}
      </button>
      {lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          Synced {relativeTime(lastSyncedAt, now)}
        </span>
      )}
    </div>
  )
}
