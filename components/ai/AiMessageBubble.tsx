"use client"

import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { RefreshCw } from "lucide-react"
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

/** Render an anchor: relative paths and known internal routes use Next.js Link; absolute external URLs open in new tab */
function SmartLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span>{children}</span>
  // Relative paths are always internal
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="text-primary underline underline-offset-2 hover:no-underline font-medium">
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  )
}

interface AiMessageBubbleProps {
  message: AiMessage
  onRetry?: () => void
}

export function AiMessageBubble({ message, onRetry }: AiMessageBubbleProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.isError) {
    return (
      <div className="flex gap-2 items-start">
        {AFROBI_AVATAR}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl rounded-tl-sm border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-3.5 py-3 shadow-sm">
            <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed">{message.content}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 hover:text-orange-900 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const productLabel = message.products?.length
    ? `Found ${message.products.length} product${message.products.length === 1 ? "" : "s"}`
    : undefined

  return (
    <div className="flex gap-2 items-start">
      {AFROBI_AVATAR}
      <div className="flex-1 min-w-0">
        {message.content && (
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground leading-relaxed shadow-sm">
            {message.isStreaming && !message.content ? (
              <TypingDots />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li className="leading-snug">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  code: ({ children }) => (
                    <code className="bg-background/60 border border-border text-foreground px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-background/60 border border-border rounded-lg p-2.5 overflow-x-auto text-[11px] font-mono mb-1.5">{children}</pre>
                  ),
                  h1: ({ children }) => <p className="font-bold text-sm text-foreground mb-1">{children}</p>,
                  h2: ({ children }) => <p className="font-bold text-sm text-foreground mb-1">{children}</p>,
                  h3: ({ children }) => <p className="font-semibold text-sm text-foreground mb-0.5">{children}</p>,
                  a: ({ href, children }) => <SmartLink href={href}>{children}</SmartLink>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-1.5">{children}</blockquote>
                  ),
                  hr: () => <hr className="border-border my-2" />,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-1.5">
                      <table className="text-[11px] border-collapse w-full">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>,
                  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
            {message.isStreaming && message.content && (
              <span className="inline-block h-4 w-0.5 bg-primary/70 ml-0.5 animate-pulse align-bottom" />
            )}
          </div>
        )}

        {/* Show typing dots if streaming but no content yet */}
        {message.isStreaming && !message.content && (
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 shadow-sm">
            <TypingDots />
          </div>
        )}

        {message.products && message.products.length > 0 && (
          <AiProductCards products={message.products} label={productLabel} />
        )}
      </div>
    </div>
  )
}
