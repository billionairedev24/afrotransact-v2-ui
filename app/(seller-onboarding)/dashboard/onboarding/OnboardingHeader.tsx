"use client"

import { LogOut, Store } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function OnboardingHeader({ userName }: { userName: string }) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-gray-200 px-4 sm:px-6 bg-white/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="AfroTransact" width={28} height={28} className="rounded-lg" />
          <span className="text-sm font-bold text-gray-900">
            <span className="text-primary">Afro</span>Transact
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 ml-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            <Store className="h-3 w-3" /> Seller Setup
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {userName && (
            <span className="hidden sm:block text-xs text-gray-500 max-w-[150px] truncate">
              {userName}
            </span>
          )}
          <a
            href="/api/auth/signout"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </a>
        </div>
      </div>
    </header>
  )
}
