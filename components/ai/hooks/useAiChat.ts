"use client"

import { useCallback } from "react"
import { useSession } from "next-auth/react"
import { useAiStore, type ProductCard } from "@/stores/ai-store"

const AI_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai`

interface SseChunk {
  type: "text_delta" | "tool_result" | "error" | "done"
  delta?: string
  tool?: string
  data?: Record<string, unknown>
  message?: string
}

function extractProducts(data: Record<string, unknown> | undefined): ProductCard[] {
  if (!data) return []
  // search_products returns { results: [...] }
  const results = (data.results ?? data) as unknown[]
  if (!Array.isArray(results)) return []
  return results.slice(0, 8).map((r: unknown) => {
    const p = r as Record<string, unknown>
    return {
      product_id: String(p.product_id ?? ""),
      title: String(p.title ?? ""),
      image_url: (p.image_url as string) ?? null,
      min_price: Number(p.min_price ?? 0),
      max_price: Number(p.max_price ?? 0),
      currency: String(p.currency ?? "USD"),
      in_stock: Boolean(p.in_stock ?? true),
      store_name: String(p.store_name ?? ""),
      slug: (p.slug as string) ?? null,
    }
  })
}

export function useAiChat() {
  const store = useAiStore()
  const { data: session } = useSession()

  const sendMessage = useCallback(
    async (text: string, enableGrounding = false) => {
      const trimmed = text.trim()
      if (!trimmed || store.isStreaming) return

      store.addUserMessage(trimmed)
      const assistantMsg = store.addAssistantMessage()
      store.setStreaming(true)

      // Snapshot last 20 messages for context (exclude the empty assistant placeholder)
      const history = store.messages
        .filter((m) => m.id !== assistantMsg.id && m.content)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }))

      const token = (session as any)?.accessToken as string | undefined
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      try {
        const res = await fetch(`${AI_BASE}/chat/stream`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: trimmed,
            session_id: store.sessionId,
            enable_grounding: enableGrounding,
            history,
          }),
        })

        if (!res.ok) {
          const err = await res.text().catch(() => "Unknown error")
          store.appendToMessage(assistantMsg.id, `Sorry, something went wrong. ${res.status === 429 ? "You've sent too many messages — please wait a moment." : "Please try again."}`)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            try {
              const chunk: SseChunk = JSON.parse(raw)

              if (chunk.type === "text_delta" && chunk.delta) {
                store.appendToMessage(assistantMsg.id, chunk.delta)
              } else if (chunk.type === "tool_result" && chunk.tool === "search_products") {
                const products = extractProducts(chunk.data)
                if (products.length > 0) {
                  store.attachProducts(assistantMsg.id, products)
                }
              } else if (chunk.type === "error") {
                store.appendToMessage(assistantMsg.id, chunk.message ?? "Something went wrong.")
              } else if (chunk.type === "done") {
                break
              }
            } catch {
              // malformed chunk — skip
            }
          }
        }
      } catch (e) {
        store.appendToMessage(assistantMsg.id, "Connection lost. Please try again.")
      } finally {
        store.finaliseMessage(assistantMsg.id)
        store.setStreaming(false)
      }
    },
    [store]
  )

  return { sendMessage, messages: store.messages, isStreaming: store.isStreaming }
}
