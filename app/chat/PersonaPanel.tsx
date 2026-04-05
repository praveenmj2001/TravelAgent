"use client";

import { useState, useEffect } from "react";
import {
  TripPersona,
  PERSONA_CATEGORIES,
  lookupEmoji,
  lookupLabel,
} from "./personaConfig";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Props {
  conversationId: string | undefined;
  persona: TripPersona | null;
  onPersonaChange: (updated: TripPersona) => void;
}

export default function PersonaPanel({ conversationId, persona, onPersonaChange }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("persona-panel-collapsed") === "true";
    }
    return false;
  });
  // Which category row is expanded for editing
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem("persona-panel-collapsed", String(collapsed));
  }, [collapsed]);

  // Close expanded row when conversation changes
  useEffect(() => {
    setExpandedKey(null);
  }, [conversationId]);

  async function patchField(field: keyof TripPersona, value: string) {
    if (!conversationId) return;
    setSaving(true);
    const updated = { ...(persona ?? {} as TripPersona), [field]: value };
    try {
      const res = await fetch(`${BACKEND}/conversations/${conversationId}/persona`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      onPersonaChange(data as TripPersona);
    } catch {
      onPersonaChange(updated);
    }
    setSaving(false);
  }

  function getValues(key: keyof TripPersona): string[] {
    const v = persona?.[key];
    return v ? v.split(",").filter(Boolean) : [];
  }

  function handleSelect(key: keyof TripPersona, value: string, multi: boolean) {
    if (multi) {
      const current = getValues(key);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      patchField(key, next.join(","));
    } else {
      patchField(key, value);
      setExpandedKey(null); // auto-collapse on single select
    }
  }

  // No conversation yet — show placeholder
  const noConv = !conversationId;

  return (
    <div
      className={`flex flex-col h-screen sticky top-0 border-l border-black/10 dark:border-gray-700 transition-all duration-300 ${
        collapsed ? "w-10" : "w-56"
      }`}
      style={{ backgroundColor: "var(--t-sidebar-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-black/10 dark:border-gray-700 shrink-0">
        {!collapsed && (
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--t-primary)] truncate">
            Trip Persona
          </span>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 ml-auto shrink-0"
          title={collapsed ? "Expand persona" : "Collapse persona"}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Collapsed icon strip */}
      {collapsed && (
        <div className="flex flex-col items-center gap-2 pt-3 px-1">
          {PERSONA_CATEGORIES.map((cat) => {
            const vals = getValues(cat.key);
            const hasValue = vals.length > 0;
            return (
              <div
                key={cat.key}
                title={`${cat.label}: ${vals.map((v) => lookupLabel(cat.options as any, v)).join(", ") || "Not set"}`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: hasValue ? "var(--t-primary-light)" : "var(--accent, #f3f4f6)",
                  color: hasValue ? "var(--t-primary)" : "var(--t-primary-text, #9ca3af)",
                }}
              >
                {hasValue
                  ? lookupEmoji(cat.options as any, vals[0])
                  : "·"}
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {noConv ? (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-4 px-2 leading-relaxed">
              Start a new trip to set your travel persona.
            </p>
          ) : (
            <>
              {saving && (
                <p className="text-[10px] text-[var(--t-primary)] text-center py-1 animate-pulse">Saving…</p>
              )}
              {PERSONA_CATEGORIES.map((cat) => {
                const vals = getValues(cat.key);
                const isExpanded = expandedKey === cat.key;

                return (
                  <div key={cat.key} className="mb-1">
                    {/* Category row — click to expand/collapse */}
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : cat.key)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 group-hover:text-[var(--t-primary)] transition-colors">
                        {cat.label}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Collapsed: show selected chips */}
                    {!isExpanded && (
                      <div className="flex flex-wrap gap-1 px-2 pb-1">
                        {vals.length > 0 ? vals.map((v) => (
                          <span
                            key={v}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}
                          >
                            {lookupEmoji(cat.options as any, v)} {lookupLabel(cat.options as any, v)}
                          </span>
                        )) : (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Not set</span>
                        )}
                      </div>
                    )}

                    {/* Expanded: show all options */}
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
                        {(cat.options as { value: string; emoji: string; label: string }[]).map((opt) => {
                          const selected = vals.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleSelect(cat.key, opt.value, cat.multi)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold transition-all"
                              style={{
                                borderColor: selected ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                                background:  selected ? "var(--t-primary-light)" : "transparent",
                                color:       selected ? "var(--t-primary)" : "var(--t-primary-text, #374151)",
                              }}
                            >
                              <span>{opt.emoji}</span>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                        {cat.multi && vals.length > 0 && (
                          <button
                            onClick={() => setExpandedKey(null)}
                            className="text-[10px] px-2 py-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
