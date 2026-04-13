"use client"

import { type AiMessage } from "@/stores/ai-store"
import { AiProductCards } from "./AiProductCards"

const AFROBI_AVATAR = (
  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black select-none">
    A
  </div>
)

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "800ms" }}
        />
      ))}
    </span>
  )
}

interface AiMessageBubbleProps {
  message: AiMessage
}

export function AiMessageBubble({ message }: AiMessageBubbleProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      {AFROBI_AVATAR}
      <div className="flex-1 min-w-0">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground leading-relaxed shadow-sm">
          {message.isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block h-4 w-0.5 bg-primary/70 ml-0.5 animate-pulse align-bottom" />
          )}
        </div>
        {message.products && message.products.length > 0 && (
          <AiProductCards products={message.products} />
        )}
      </div>
    </div>
  )
}
