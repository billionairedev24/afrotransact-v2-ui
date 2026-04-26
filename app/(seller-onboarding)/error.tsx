"use client"

import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary"

export default function OnboardingError({
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
      scopeLabel="onboarding flow"
      homeHref="/dashboard/onboarding"
      homeLabel="Back to onboarding"
    />
  )
}
