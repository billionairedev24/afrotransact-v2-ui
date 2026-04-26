"use client"

import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary"

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      scopeLabel="page"
      homeHref="/"
      homeLabel="Go home"
    />
  )
}
