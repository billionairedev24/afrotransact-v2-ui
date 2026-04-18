"use client"

import { useCallback, useEffect, useRef } from "react"

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  // Prioritised list of known natural-sounding female English voices
  const preferredNames = [
    // macOS / iOS
    "Samantha",
    "Ava",
    "Allison",
    "Susan",
    "Victoria",
    "Karen",         // Australian
    "Moira",         // Irish
    "Veena",         // Indian English
    // Windows / Edge neural voices
    "Microsoft Aria Online (Natural)",
    "Microsoft Aria",
    "Microsoft Jenny Online (Natural)",
    "Microsoft Jenny",
    "Microsoft Michelle Online (Natural)",
    "Microsoft Michelle",
    "Microsoft Emma Online (Natural)",
    "Microsoft Emma",
    // Android / Chrome
    "Google US English",
    "Google UK English Female",
  ]
  for (const name of preferredNames) {
    const v = voices.find((v) => v.name === name)
    if (v) return v
  }
  // Fall back to any English voice whose name hints at female
  const femaleKeywords = ["female", "woman", "girl", "aria", "jenny", "emma", "victoria", "samantha", "ava", "zira"]
  const femaleHint = voices.find((v) =>
    v.lang.startsWith("en") &&
    femaleKeywords.some((kw) => v.name.toLowerCase().includes(kw))
  )
  if (femaleHint) return femaleHint
  // Last resort: any English voice
  return voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null
}

export function useTextToSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Voices load asynchronously in some browsers
  useEffect(() => {
    if (!supported) return
    window.speechSynthesis.getVoices() // warm up
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return
      window.speechSynthesis.cancel() // stop any current speech

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.pitch = 1
      utterance.volume = 1

      const voice = pickFemaleVoice()
      if (voice) utterance.voice = voice

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [supported],
  )

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
  }, [supported])

  return { speak, stop, supported }
}
