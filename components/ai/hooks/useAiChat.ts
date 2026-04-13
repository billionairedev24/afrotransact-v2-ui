"use client"

import { useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useAiStore, type ProductCard } from "@/stores/ai-store"
import { useCartStore } from "@/stores/cart-store"
import { useTextToSpeech } from "./useTextToSpeech"

const AI_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai`

const ACKS = [
  "On it! 🔍",
  "Got it, let me check…",
  "Sure! Looking into that…",
  "Let me find that for you…",
  "One moment…",
]
function randomAck() {
  return ACKS[Math.floor(Math.random() * ACKS.length)]
}

/** Strip markdown and emoji for clean TTS output. Keeps the first 2 sentences only. */
function cleanForSpeech(text: string): string {
  return text
    // Remove markdown links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    // Remove headings
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bullet points
    .replace(/^[-*•]\s+/gm, "")
    // Remove numbered list markers
    .replace(/^\d+\.\s+/gm, "")
    // Remove inline code
    .replace(/`[^`]+`/g, "")
    // Remove blockquotes
    .replace(/^>\s*/gm, "")
    // Remove emoji (basic unicode ranges)
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    // Collapse whitespace
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    // Keep only first 2 sentences so TTS stays brief
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
}

interface SseChunk {
  type: "text_delta" | "tool_result" | "error" | "done"
  delta?: string
  tool?: string
  data?: Record<string, unknown>
  message?: string
}

function extractProducts(data: Record<string, unknown> | undefined): ProductCard[] {
  if (!data) return []
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
  const { appendToMessage, resetMessage } = store
  const { speak, stop: stopSpeaking } = useTextToSpeech()
  const addCartItem = useCartStore((s) => s.addItem)
  const voiceTriggeredRef = useRef(false)

  const sendMessage = useCallback(
    async (text: string, enableGrounding = false, fromVoice = false) => {
      const { isStreaming, sessionId, addUserMessage, addAssistantMessage,
              setStreaming, attachProducts, finaliseMessage, markMessageError } = useAiStore.getState()

      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      stopSpeaking()
      voiceTriggeredRef.current = fromVoice
      addUserMessage(trimmed)
      const assistantMsg = addAssistantMessage()
      setStreaming(true)

      appendToMessage(assistantMsg.id, randomAck())

      const token = (session as any)?.accessToken as string | undefined
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      let fullResponse = ""

      try {
        const res = await fetch(`${AI_BASE}/chat/stream`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: trimmed,
            session_id: sessionId,
            enable_grounding: enableGrounding,
          }),
        })

        if (!res.ok) {
          const errorText = res.status === 429
            ? "You've sent too many messages — please wait a moment before trying again."
            : res.status >= 500
            ? "Victory is temporarily offline. Please try again in a few minutes! 🛠️"
            : `Something went wrong (${res.status}). Please try again.`
          markMessageError(assistantMsg.id, errorText)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        let buffer = ""
        let firstDelta = true

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
                if (firstDelta) {
                  resetMessage(assistantMsg.id)
                  firstDelta = false
                }
                fullResponse += chunk.delta
                appendToMessage(assistantMsg.id, chunk.delta)

              } else if (chunk.type === "tool_result") {
                if (
                  chunk.tool === "search_products" ||
                  chunk.tool === "get_recommendations" ||
                  chunk.tool === "get_deals"
                ) {
                  const products = extractProducts(chunk.data)
                  if (products.length > 0) attachProducts(assistantMsg.id, products)

                } else if (chunk.tool === "add_to_cart" && chunk.data?.action === "add_to_cart") {
                  // The AI fetched product details — add to the client-side Zustand cart
                  const d = chunk.data as Record<string, unknown>
                  try {
                    addCartItem({
                      productId:   String(d.productId ?? ""),
                      variantId:   String(d.variantId ?? ""),
                      storeId:     String(d.storeId ?? ""),
                      storeName:   String(d.storeName ?? ""),
                      title:       String(d.title ?? ""),
                      variantName: String(d.variantName ?? "Default"),
                      price:       Number(d.price ?? 0),
                      quantity:    Number(d.quantity ?? 1),
                      imageUrl:    (d.imageUrl as string) ?? undefined,
                      slug:        (d.slug as string) ?? undefined,
                      weightKg:    (d.weightKg as number) ?? null,
                      lengthIn:    (d.lengthIn as number) ?? null,
                      widthIn:     (d.widthIn as number) ?? null,
                      heightIn:    (d.heightIn as number) ?? null,
                    })
                  } catch {
                    // Cart add failed silently — AI text response will describe what happened
                  }
                }

              } else if (chunk.type === "error") {
                markMessageError(
                  assistantMsg.id,
                  chunk.message ?? "Something went wrong on my end. Please try again."
                )
              } else if (chunk.type === "done") {
                break
              }
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }

        if (firstDelta) resetMessage(assistantMsg.id)

      } catch {
        markMessageError(
          assistantMsg.id,
          "Looks like the connection dropped. Check your internet and try again."
        )
      } finally {
        useAiStore.getState().finaliseMessage(assistantMsg.id)
        useAiStore.getState().setStreaming(false)
        // Speak only the cleaned conversational text, not the full markdown response
        if (voiceTriggeredRef.current && fullResponse) {
          speak(cleanForSpeech(fullResponse))
        }
      }
    },
    [session, appendToMessage, resetMessage, speak, stopSpeaking, addCartItem]
  )

  return { sendMessage, messages: store.messages, isStreaming: store.isStreaming }
}
