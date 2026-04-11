"use client";

import { VoiceState } from "./useVoiceInput";

interface Props {
  state: VoiceState;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
}

export default function MicButton({ state, onToggle, size = "md" }: Props) {
  if (state === "unsupported") return null;

  const isListening = state === "listening";

  // Dimensions: sm=28px, md=40px (matches textarea height), lg=108px
  const btnPx = size === "sm" ? 28 : size === "lg" ? 108 : 40;
  const ring1Px = size === "sm" ? 28 : size === "lg" ? 108 : 40;
  const ring2Px = size === "sm" ? 40 : size === "lg" ? 148 : 56;
  const iconPx  = size === "sm" ? 14 : size === "lg" ? 44  : 18;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: btnPx, height: btnPx }}>
      {/* Pulse rings when listening */}
      {isListening && (
        <>
          <span className="absolute inline-flex rounded-full opacity-60 animate-ping"
            style={{ width: ring1Px, height: ring1Px, background: "#ef4444" }} />
          <span className="absolute inline-flex rounded-full opacity-30 animate-ping"
            style={{ width: ring2Px, height: ring2Px, background: "#ef4444", animationDelay: "150ms" }} />
        </>
      )}
      <button
        type="button"
        onClick={onToggle}
        title={isListening ? "Stop listening" : "Speak your message"}
        style={{ width: btnPx, height: btnPx }}
        className={`relative z-10 rounded-full flex items-center justify-center transition-all duration-200 ${
          isListening
            ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-red-900"
            : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        }`}
      >
        {isListening ? (
          /* Stop / waveform icon */
          <svg xmlns="http://www.w3.org/2000/svg" style={{ width: iconPx, height: iconPx }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          /* Mic icon */
          <svg xmlns="http://www.w3.org/2000/svg" style={{ width: iconPx, height: iconPx }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
          </svg>
        )}
      </button>
      {/* "Listening" label */}
      {isListening && (
        <span
          className="absolute font-semibold text-red-500 whitespace-nowrap animate-pulse"
          style={{
            bottom: size === "lg" ? -22 : -20,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: size === "lg" ? 12 : 9,
          }}
        >
          Listening…
        </span>
      )}
    </div>
  );
}
