"use client";

import { useState, useEffect } from "react";
import {
  TripPersona,
  EMPTY_PERSONA,
  TRAVELLING_AS,
  TRAVEL_STYLE,
  TRIP_LENGTH,
  INTERESTS,
  DIETARY,
  MEET_TIME,
} from "./personaConfig";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

// ── Standard trip steps (shown after travelling_as, when not meetup) ─────────
const TRIP_STEPS = [
  { key: "travel_style" as keyof TripPersona, label: "What's your travel style?", options: TRAVEL_STYLE,  multi: false },
  { key: "trip_length"  as keyof TripPersona, label: "How long is this trip?",    options: TRIP_LENGTH,   multi: false },
  { key: "interests"    as keyof TripPersona, label: "What do you love most?",    options: INTERESTS,     multi: true  },
  { key: "dietary"      as keyof TripPersona, label: "Dietary preferences?",      options: DIETARY,       multi: true  },
];

interface Props {
  userEmail: string;
  conversationId: string;
  onComplete: (persona: TripPersona) => void;
  onSkip: () => void;
}

export default function PersonaSheet({ userEmail, conversationId, onComplete, onSkip }: Props) {
  const [persona, setPersona] = useState<TripPersona>(EMPTY_PERSONA);
  const [tripStep, setTripStep] = useState(0); // index into TRIP_STEPS (only used for non-meetup)
  // meetup sub-step: 0=location, 1=time, 2=date
  const [meetupStep, setMeetupStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(false);

  const isMeetup = persona.travelling_as === "meetup";
  // Phase: "profile" = picking travelling_as, "detail" = subsequent questions
  const phase = persona.travelling_as ? "detail" : "profile";

  // After travelling_as chosen (non-meetup), prefill from last session of same type
  useEffect(() => {
    if (phase !== "detail" || isMeetup || !persona.travelling_as) return;
    setPrefilling(true);
    fetch(
      `${BACKEND}/conversations/last-persona?user_email=${encodeURIComponent(userEmail)}&travelling_as=${encodeURIComponent(persona.travelling_as)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setPersona((p) => ({
            ...p,
            travel_style: data.travel_style ?? p.travel_style,
            trip_length:  data.trip_length  ?? p.trip_length,
            interests:    data.interests    ?? p.interests,
            dietary:      data.dietary      ?? p.dietary,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setPrefilling(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.travelling_as]);

  function getValues(key: keyof TripPersona): string[] {
    const v = persona[key];
    return v ? v.split(",").filter(Boolean) : [];
  }

  function selectSingle(key: keyof TripPersona, value: string) {
    setPersona((p) => ({ ...p, [key]: value }));
  }

  function toggleMulti(key: keyof TripPersona, value: string) {
    const cur = getValues(key);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setPersona((p) => ({ ...p, [key]: next.join(",") }));
  }

  async function saveAndFinish(finalPersona: TripPersona) {
    setSaving(true);
    try {
      await fetch(`${BACKEND}/conversations/${conversationId}/persona`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPersona),
      });
      window.dispatchEvent(new Event("persona-updated"));
      onComplete(finalPersona);
    } catch {
      onComplete(finalPersona);
    }
    setSaving(false);
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function ChipGrid({
    options, selectedKey, multi,
  }: {
    options: { value: string; emoji: string; label: string }[];
    selectedKey: keyof TripPersona;
    multi: boolean;
  }) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {options.map((opt) => {
          const selected = multi
            ? getValues(selectedKey).includes(opt.value)
            : persona[selectedKey] === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => multi ? toggleMulti(selectedKey, opt.value) : selectSingle(selectedKey, opt.value)}
              className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl border-2 font-semibold transition-all"
              style={{
                borderColor: selected ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                background:  selected ? "var(--t-primary-light, #ecfdf5)" : "transparent",
                color:       selected ? "var(--t-primary)" : "var(--t-primary-text, #374151)",
              }}
            >
              <span className="text-xl leading-none">{opt.emoji}</span>
              <span className="text-[10px] leading-tight text-center">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Total steps for progress bar
  const totalSteps = isMeetup ? 4 : 1 + TRIP_STEPS.length; // 1 profile + N detail
  const currentStepIndex = phase === "profile" ? 0 : isMeetup ? 1 + meetupStep : 1 + tripStep;

  // ── Profile step (travelling_as) ─────────────────────────────────────────────
  function renderProfileStep() {
    return (
      <>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">How are you travelling?</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Let's personalise this trip before we start.</p>
        <ChipGrid options={TRAVELLING_AS} selectedKey="travelling_as" multi={false} />
        <div className="flex items-center justify-between mt-5">
          <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Skip</button>
          <button
            onClick={() => { /* selecting a chip advances automatically */ }}
            disabled={!persona.travelling_as}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--t-primary)" }}
          >
            Next
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </>
    );
  }

  // Auto-advance when travelling_as is picked
  useEffect(() => {
    if (persona.travelling_as && phase === "profile") {
      // small delay so user sees the selection
      const t = setTimeout(() => {
        // already in detail phase via re-render — nothing to do, phase computed from state
      }, 200);
      return () => clearTimeout(t);
    }
  }, [persona.travelling_as, phase]);

  // ── Meetup detail steps ──────────────────────────────────────────────────────
  function renderMeetupStep() {
    if (meetupStep === 0) {
      return (
        <>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Where do you plan to meet?</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">City, neighbourhood, or a specific area.</p>
          <input
            type="text"
            value={persona.meet_location}
            onChange={(e) => setPersona((p) => ({ ...p, meet_location: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter" && persona.meet_location.trim()) setMeetupStep(1); }}
            placeholder="e.g. Downtown Seattle, Pike Place area…"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-gray-900 dark:text-white dark:bg-gray-800 outline-none focus:ring-2 text-sm"
            style={{ "--tw-ring-color": "var(--t-primary)" } as React.CSSProperties}
            autoFocus
          />
          {renderMeetupActions(() => setMeetupStep(1), !!persona.meet_location.trim())}
        </>
      );
    }

    if (meetupStep === 1) {
      return (
        <>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">What time of day?</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">When are you planning to meet?</p>
          <ChipGrid options={MEET_TIME} selectedKey="meet_time" multi={false} />
          {renderMeetupActions(() => setMeetupStep(2), !!persona.meet_time)}
        </>
      );
    }

    if (meetupStep === 2) {
      const today = new Date().toISOString().split("T")[0];
      const isToday = persona.meet_date === "today" || persona.meet_date === today;
      return (
        <>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Which date?</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Is this today or a future date?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setPersona((p) => ({ ...p, meet_date: "today" }))}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all"
              style={{
                borderColor: isToday ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                background:  isToday ? "var(--t-primary-light)" : "transparent",
                color:       isToday ? "var(--t-primary)" : "var(--t-primary-text, #374151)",
              }}
            >
              <span className="text-xl">📅</span> Today
            </button>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Or pick a date:</p>
              <input
                type="date"
                min={today}
                value={persona.meet_date === "today" ? "" : persona.meet_date}
                onChange={(e) => setPersona((p) => ({ ...p, meet_date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-gray-900 dark:text-white dark:bg-gray-800 outline-none focus:ring-2 text-sm"
                style={{ "--tw-ring-color": "var(--t-primary)" } as React.CSSProperties}
              />
            </div>
          </div>
          {renderMeetupActions(() => saveAndFinish(persona), !!persona.meet_date, true)}
        </>
      );
    }
  }

  function renderMeetupActions(onNext: () => void, canNext: boolean, isLast = false) {
    return (
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={isLast ? () => saveAndFinish(persona) : () => setMeetupStep((s) => s + 1)}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          disabled={!canNext || saving}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
          style={{ background: "var(--t-primary)" }}
        >
          {saving ? <span className="animate-pulse">Starting…</span> : isLast ? "Let's go 🤝" : (
            <>Next <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>
          )}
        </button>
      </div>
    );
  }

  // ── Standard trip detail steps ────────────────────────────────────────────────
  function renderTripStep() {
    const step = TRIP_STEPS[tripStep];
    const isLast = tripStep === TRIP_STEPS.length - 1;
    const canNext = step.multi ? true : !!persona[step.key];

    return (
      <>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{step.label}</h2>
        {step.multi && <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Select all that apply.</p>}
        {prefilling && <p className="text-xs text-[var(--t-primary)] mb-3 animate-pulse">Loading your last preferences…</p>}
        <ChipGrid options={step.options as any} selectedKey={step.key} multi={step.multi} />
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => isLast ? saveAndFinish(persona) : setTripStep((s) => s + 1)}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => isLast ? saveAndFinish(persona) : setTripStep((s) => s + 1)}
            disabled={!canNext || saving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--t-primary)" }}
          >
            {saving ? <span className="animate-pulse">Starting…</span> : isLast ? "Let's go 🚗" : (
              <>Next <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 z-40" onClick={onSkip} />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--card-bg, white)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + close */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 relative">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 absolute left-1/2 -translate-x-1/2 top-3" />
          <div className="flex-1" />
          <button
            onClick={onSkip}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-6">
          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-all duration-300"
                style={{ background: i <= currentStepIndex ? "var(--t-primary)" : "var(--accent, #e5e7eb)" }}
              />
            ))}
          </div>

          {/* Content */}
          {phase === "profile"
            ? renderProfileStep()
            : isMeetup
              ? renderMeetupStep()
              : renderTripStep()
          }
        </div>
      </div>
    </>
  );
}
