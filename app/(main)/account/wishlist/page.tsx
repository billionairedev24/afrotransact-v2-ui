"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Heart, ShoppingBag } from "lucide-react"

export default function WishlistPage() {
  const { status } = useSession()

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <Heart className="mx-auto h-14 w-14 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900 mt-5">Sign in to view your wishlist</h1>
        <Link
          href="/auth/login"
          className="inline-block mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Wishlist</h1>

      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <Heart className="mx-auto h-14 w-14 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900 mt-5">Your wishlist is empty</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
          Save products you love by tapping the heart icon. Your wishlist helps you keep track of items you want to buy later.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors"
        >
          <ShoppingBag className="h-4 w-4" />
          Browse Products
        </Link>
      </div>
    </main>
  )
}
