"use client"

import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary"

export default function AdminError({
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
      scopeLabel="admin dashboard"
      homeHref="/admin"
      homeLabel="Back to admin home"
    />
  )
}
