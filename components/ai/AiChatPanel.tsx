"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Trash2, X, Maximize2, Minimize2 } from "lucide-react"
import { useAiStore } from "@/stores/ai-store"
import { useAiChat } from "./hooks/useAiChat"
import { useVoiceInput } from "./hooks/useVoiceInput"
import { AiMessageBubble } from "./AiMessageBubble"
import { AiVoiceButton } from "./AiVoiceButton"

const QUICK_REPLIES = [
  "What's popular today?",
  "Find me a deal",
  "Track my last order",
  "Show me African snacks",
]

export function AiChatPanel() {
  const { messages, isStreaming, sendMessage } = useAiChat()
  const { close, setExpanded, isExpanded, clearHistory, isListening } = useAiStore()
  const [input, setInput] = useState("")
  const [interimText, setInterimText] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { supported: voiceSupported, toggle: toggleVoice } = useVoiceInput({
    onTranscript: (text) => {
      setInterimText("")
      setInput("")
      sendMessage(text)
    },
    onInterim: (text) => setInterimText(text),
  })

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  // Focus input when panel opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    sendMessage(text)
  }

  const isEmpty = messages.length === 0

  return (
    <div
      className={`flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
        isExpanded
          ? "fixed inset-4 sm:inset-auto sm:bottom-[88px] sm:right-4 sm:w-[480px] sm:h-[75vh] z-[60]"
          : "w-full h-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-black select-none">
          A
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-none">Afrobi</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isListening ? (
              <span className="text-red-500 font-medium animate-pulse">Listening…</span>
            ) : isStreaming ? (
              <span className="text-primary font-medium">Thinking…</span>
            ) : (
              "AI Shopping Assistant"
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear conversation"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!isExpanded)}
            title={isExpanded ? "Minimise" : "Expand"}
            className="hidden sm:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={close}
            title="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 scroll-smooth">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl select-none">
              🛒
            </div>
            <div>
              <p className="font-bold text-foreground text-base">Hey! I&apos;m Afrobi</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Your African shopping guide. Ask me anything — I can find products, track orders, and more!
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full mt-2">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-foreground leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <AiMessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Voice interim text */}
      {interimText && (
        <div className="px-4 py-1.5 text-xs text-muted-foreground italic border-t border-border bg-muted/30">
          {interimText}…
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card px-3 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {voiceSupported && (
            <AiVoiceButton
              isListening={isListening}
              supported={voiceSupported}
              onToggle={toggleVoice}
              size="sm"
            />
          )}
          <input
            ref={inputRef}
            value={isListening ? interimText : input}
            onChange={(e) => !isListening && setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit(e as unknown as React.FormEvent)}
            placeholder={isListening ? "Listening…" : "Ask Afrobi anything…"}
            disabled={isStreaming || isListening}
            className="flex-1 min-w-0 bg-muted/50 border border-border rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 transition-all"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !isListening) || isStreaming}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
