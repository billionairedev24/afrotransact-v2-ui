"use client"

import { useEffect } from "react"

/**
 * Last-resort error boundary. This file is rendered when an error happens in
 * the root layout itself, so it must include its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global-error]", error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafafa" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            color: "#171717",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", color: "#525252", maxWidth: 480 }}>
            We hit an unexpected error. Try again, or refresh the page.
            {error.digest && (
              <span style={{ display: "block", marginTop: "0.5rem", fontSize: "0.75rem", color: "#737373" }}>
                Reference: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #e5e5e5",
              background: "#fff",
              color: "#171717",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
