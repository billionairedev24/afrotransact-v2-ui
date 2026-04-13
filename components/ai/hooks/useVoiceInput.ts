"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAiStore } from "@/stores/ai-store"

// Web Speech API types (not in default TS lib without dom.speech)
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorResult) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionResultEvent = {
  resultIndex: number
  results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } }
}
type SpeechRecognitionErrorResult = { error: string }
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onInterim?: (text: string) => void
}

export function useVoiceInput({ onTranscript, onInterim }: UseVoiceInputOptions) {
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setListening = useAiStore((s) => s.setListening)
  const isListening = useAiStore((s) => s.isListening)

  useEffect(() => {
    const w = window as SpeechWindow
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition))
  }, [])

  const stop = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
    setListening(false)
  }, [setListening])

  const start = useCallback(() => {
    setError(null)
    const w = window as SpeechWindow
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) {
      setError("Voice input is not supported in this browser.")
      return
    }

    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = navigator.language || "en-US"
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }

      if (interim && onInterim) onInterim(interim)

      if (final) {
        onTranscript(final.trim())
        stop()
      } else {
        silenceTimerRef.current = setTimeout(() => {
          if (interim.trim()) onTranscript(interim.trim())
          stop()
        }, 1500)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorResult) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone permissions.")
      } else if (event.error !== "aborted") {
        setError("Voice recognition failed. Please try again.")
      }
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript, onInterim, stop, setListening])

  const toggle = useCallback(() => {
    if (isListening) stop()
    else start()
  }, [isListening, start, stop])

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop])

  return { supported, isListening, error, start, stop, toggle }
}
