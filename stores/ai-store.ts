import { create } from "zustand"
import { nanoid } from "nanoid"

export type MessageRole = "user" | "assistant"

export interface ProductCard {
  product_id: string
  title: string
  image_url: string | null
  min_price: number
  max_price: number
  currency: string
  in_stock: boolean
  store_name: string
  slug: string | null
}

export interface AiMessage {
  id: string
  role: MessageRole
  content: string
  products?: ProductCard[]
  toolName?: string
  isStreaming?: boolean
  timestamp: number
}

interface AiStore {
  isOpen: boolean
  isExpanded: boolean
  messages: AiMessage[]
  sessionId: string
  isStreaming: boolean
  isListening: boolean   // voice recording active
  inputMode: "text" | "voice"

  open: () => void
  close: () => void
  toggle: () => void
  setExpanded: (v: boolean) => void
  setListening: (v: boolean) => void
  setInputMode: (m: "text" | "voice") => void

  addUserMessage: (content: string) => AiMessage
  addAssistantMessage: () => AiMessage
  appendToMessage: (id: string, delta: string) => void
  attachProducts: (id: string, products: ProductCard[]) => void
  finaliseMessage: (id: string) => void
  clearHistory: () => void
  setStreaming: (v: boolean) => void
}

export const useAiStore = create<AiStore>((set, get) => ({
  isOpen: false,
  isExpanded: false,
  messages: [],
  sessionId: nanoid(),
  isStreaming: false,
  isListening: false,
  inputMode: "text",

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setExpanded: (v) => set({ isExpanded: v }),
  setListening: (v) => set({ isListening: v }),
  setInputMode: (m) => set({ inputMode: m }),

  addUserMessage: (content) => {
    const msg: AiMessage = { id: nanoid(), role: "user", content, timestamp: Date.now() }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },

  addAssistantMessage: () => {
    const msg: AiMessage = {
      id: nanoid(),
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: Date.now(),
    }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },

  appendToMessage: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m
      ),
    })),

  attachProducts: (id, products) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, products } : m
      ),
    })),

  finaliseMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
    })),

  clearHistory: () => set({ messages: [], sessionId: nanoid() }),
  setStreaming: (v) => set({ isStreaming: v }),
}))
