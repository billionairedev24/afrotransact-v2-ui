"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { CartMergeProvider } from "@/components/providers/CartMergeProvider"
import { SessionGuard } from "@/components/providers/SessionGuard"
import { PostLoginRedirect } from "@/components/providers/PostLoginRedirect"
import { IdleTimeoutProvider } from "@/components/providers/IdleTimeoutProvider"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,   // Show cached data instantly; refetch silently after 2 min
            gcTime: 15 * 60 * 1000,     // Keep cache warm for the whole browsing session
            retry: 2,
            refetchOnWindowFocus: false,
            placeholderData: (prev: unknown) => prev,  // No content flash on tab re-focus
          },
        },
      })
  )

  return (
    <SessionProvider refetchInterval={4 * 60} refetchOnWindowFocus={true}>
      <SessionGuard>
        <IdleTimeoutProvider>
        <PostLoginRedirect>
          <QueryClientProvider client={queryClient}>
            <CartMergeProvider>
              {children}
            <Toaster
              theme="light"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#fff",
                  border: "1px solid hsl(0 0% 90%)",
                  color: "#171717",
                },
              }}
            />
            </CartMergeProvider>
          </QueryClientProvider>
        </PostLoginRedirect>
        </IdleTimeoutProvider>
      </SessionGuard>
    </SessionProvider>
  )
}
