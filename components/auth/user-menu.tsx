"use client"

import { useSession, signIn } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { User, LogOut, Package, Settings, ChevronDown } from "lucide-react"

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (status === "loading") {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
    )
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => signIn()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign In
        </button>
        <Link
          href="/auth/register"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-colors hover:bg-accent"
        >
          Register
        </Link>
      </div>
    )
  }

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {initials}
        </div>
        <span className="hidden text-sm font-medium text-foreground sm:inline">
          {session.user.name?.split(" ")[0]}
        </span>
        <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card shadow-xl shadow-black/20">
          <div className="border-b border-border p-3">
            <p className="text-sm font-medium text-card-foreground truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {session.user.email}
            </p>
          </div>

          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              Profile
            </Link>
            <Link
              href="/orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
            >
              <Package className="h-4 w-4 text-muted-foreground" />
              Orders
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Settings
            </Link>
          </div>

          <div className="border-t border-border p-1">
            <button
              onClick={() => { window.location.href = "/api/auth/signout" }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
