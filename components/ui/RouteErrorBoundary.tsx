"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"

/**
 * Shared body for per-route-group error.tsx pages. Keeps each error.tsx tiny
 * while the chrome (icon, copy, actions) lives here.
 */
export function RouteErrorBoundary({
  error,
  reset,
  scopeLabel,
  homeHref = "/",
  homeLabel = "Go home",
}: {
  error: Error & { digest?: string }
  reset: () => void
  /** Short label shown to the user, e.g. "admin dashboard". */
  scopeLabel: string
  homeHref?: string
  homeLabel?: string
}) {
  useEffect(() => {
    console.error(`[error:${scopeLabel}]`, error)
  }, [error, scopeLabel])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        We couldn&apos;t load the {scopeLabel}. The team has been notified — you can try again or head home.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#0f0f10] transition-colors hover:bg-primary/90"
        >
          <RotateCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href={homeHref}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  )
}
