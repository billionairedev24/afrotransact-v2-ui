"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { CartMergeProvider } from "@/components/providers/CartMergeProvider"
import { SessionGuard } from "@/components/providers/SessionGuard"
import { PostLoginRedirect } from "@/components/providers/PostLoginRedirect"
import { IdleTimeoutProvider } from "@/components/providers/IdleTimeoutProvider"
import { Toaster } from "sonner"
import { useAdsStore } from "@/stores/useAdsStore"

function AdsLoader() {
  const loadFromApi = useAdsStore((s) => s.loadFromApi)
  useEffect(() => { loadFromApi() }, [loadFromApi])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // Prefer cache on navigation; fewer duplicate API calls
            gcTime: 30 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
            placeholderData: (prev: unknown) => prev,  // No content flash on tab re-focus
          },
        },
      })
  )

  return (
    <SessionProvider refetchInterval={10 * 60} refetchOnWindowFocus={false}>
      <SessionGuard>
        <IdleTimeoutProvider>
        <PostLoginRedirect>
          <QueryClientProvider client={queryClient}>
            <CartMergeProvider>
              <AdsLoader />
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
