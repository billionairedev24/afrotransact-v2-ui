"use client"

import { LogOut, Store } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function OnboardingHeader({ userName }: { userName: string }) {
  return (
    <header
      className="sticky top-0 z-40 border-b px-4 sm:px-6"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "hsl(0 0% 7% / 0.95)", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="AfroTransact" width={28} height={28} className="rounded-lg" />
          <span className="text-sm font-bold text-white">
            <span className="text-primary">Afro</span>Transact
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            <Store className="h-3 w-3" /> Seller Setup
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {userName && (
            <span className="hidden sm:block text-xs text-gray-400 max-w-[150px] truncate">
              {userName}
            </span>
          )}
          <a
            href="/api/auth/signout"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </a>
        </div>
      </div>
    </header>
  )
}
