"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "unsupported";

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;   // called with final transcript
  onInterim?: (text: string) => void;     // called with in-progress text
  autoSend?: boolean;                     // if true, call onSend when speech ends
  onSend?: () => void;
  silenceMs?: number;                     // ms of silence before auto-stopping (default 4000)
}

export function useVoiceInput({ onTranscript, onInterim, autoSend, onSend, silenceMs = 4000 }: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<any>(null);
  const stoppedManuallyRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check support once on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) setState("unsupported");
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    stoppedManuallyRef.current = true;
    recognitionRef.current?.stop();
    setState("idle");
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setState("unsupported"); return; }

    stoppedManuallyRef.current = false;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: any) => {
      // User is speaking — reset any pending silence timer
      clearSilenceTimer();
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) onInterim?.(interim);
      if (final) {
        onTranscript(final.trim());
        // Don't stop yet — wait silenceMs for the user to continue speaking
        if (autoSend) {
          clearSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            stoppedManuallyRef.current = true;
            recognition.stop();
            setState("idle");
            onSend?.();
          }, silenceMs);
        }
      }
    };

    recognition.onspeechend = () => {
      // Instead of stopping immediately, give the user silenceMs to continue
      if (!stoppedManuallyRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          stoppedManuallyRef.current = true;
          recognition.stop();
          setState("idle");
        }, silenceMs);
      }
    };

    recognition.onerror = (e: any) => {
      clearSilenceTimer();
      if (e.error !== "aborted") setState("idle");
    };

    recognition.onend = () => {
      clearSilenceTimer();
      if (!stoppedManuallyRef.current) setState("idle");
    };

    recognition.start();
  }, [onTranscript, onInterim, autoSend, onSend, silenceMs, clearSilenceTimer]);

  const toggle = useCallback(() => {
    if (state === "listening") stop();
    else start();
  }, [state, start, stop]);

  return { state, toggle, stop };
}
