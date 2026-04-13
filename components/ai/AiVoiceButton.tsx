"use client"

import { useEffect, useRef } from "react"
import { Mic, MicOff } from "lucide-react"

interface AiVoiceButtonProps {
  isListening: boolean
  supported: boolean
  onToggle: () => void
  size?: "sm" | "md"
  className?: string
}

export function AiVoiceButton({
  isListening,
  supported,
  onToggle,
  size = "md",
  className = "",
}: AiVoiceButtonProps) {
  const barsRef = useRef<HTMLSpanElement[]>([])

  // Animate bars when listening using Web Audio-inspired random heights
  useEffect(() => {
    if (!isListening) {
      barsRef.current.forEach((b) => b && (b.style.transform = "scaleY(0.3)"))
      return
    }
    let raf: number
    const animate = () => {
      barsRef.current.forEach((b) => {
        if (!b) return
        const scale = 0.3 + Math.random() * 0.7
        b.style.transform = `scaleY(${scale})`
      })
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [isListening])

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  const btnSize = size === "sm" ? "h-7 w-7" : "h-9 w-9"

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input is not supported in this browser. Try Chrome or Safari."
        className={`relative flex items-center justify-center rounded-full shrink-0 opacity-30 cursor-not-allowed bg-muted text-muted-foreground ${btnSize} ${className}`}
      >
        <MicOff className={iconSize} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      title={isListening ? "Stop listening" : "Speak your message"}
      className={`relative flex items-center justify-center rounded-full transition-all duration-200 shrink-0 ${
        isListening
          ? "bg-red-500 text-white shadow-lg shadow-red-500/40 scale-105"
          : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
      } ${btnSize} ${className}`}
    >
      {isListening ? (
        /* Waveform bars */
        <span className="flex items-center gap-[2px] h-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              ref={(el) => { if (el) barsRef.current[i] = el }}
              className="block w-[3px] rounded-full bg-white origin-bottom transition-transform"
              style={{
                height: size === "sm" ? "10px" : "14px",
                transform: "scaleY(0.3)",
                transitionDuration: "80ms",
                display: "block",
              }}
            />
          ))}
        </span>
      ) : (
        <Mic className={iconSize} />
      )}

      {/* Ping ring when listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-full bg-red-400 opacity-30 animate-ping" />
      )}
    </button>
  )
}
