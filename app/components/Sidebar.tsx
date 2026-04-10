"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  TripPersona,
  PERSONA_CATEGORIES,
  MEETUP_DISPLAY_CATEGORIES,
  MEET_TIME,
  lookupEmoji,
  lookupLabel,
} from "@/app/chat/personaConfig";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [persona, setPersona] = useState<TripPersona | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeId = searchParams.get("id");

  const fetchConversations = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(`${BACKEND}/conversations?user_email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      setConversations(data);
    } catch {}
  }, [userEmail]);

  const fetchPersona = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`${BACKEND}/conversations/${convId}`);
      const data = await res.json();
      const p = data.persona as TripPersona;
      const hasPersona = p && (p.travelling_as || p.travel_style || p.trip_length || p.interests || p.dietary);
      setPersona(hasPersona ? p : null);
    } catch {}
  }, []);

  useEffect(() => {
    setDark(localStorage.getItem("dark-mode") === "true");
  }, []);

  useEffect(() => {
    fetchConversations();
    window.addEventListener("conversation-updated", fetchConversations);
    return () => window.removeEventListener("conversation-updated", fetchConversations);
  }, [fetchConversations]);

  // Fetch persona when active conversation changes
  useEffect(() => {
    if (activeId) {
      fetchPersona(activeId);
      setExpandedKey(null);
    } else {
      setPersona(null);
    }
  }, [activeId, fetchPersona]);

  // Re-fetch persona when PersonaSheet completes
  useEffect(() => {
    function onPersonaUpdated() {
      if (activeId) fetchPersona(activeId);
    }
    window.addEventListener("persona-updated", onPersonaUpdated);
    return () => window.removeEventListener("persona-updated", onPersonaUpdated);
  }, [activeId, fetchPersona]);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("dark-mode", String(next));
    document.documentElement.classList.toggle("dark", next);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`${BACKEND}/conversations/${id}`, { method: "DELETE" });
    fetchConversations();
    if (activeId === id) router.push("/chat");
  }

  function startRename(e: React.MouseEvent, id: string, currentTitle: string) {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  async function submitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      await fetch(`${BACKEND}/conversations/${id}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      fetchConversations();
    }
    setRenamingId(null);
  }

  function getValues(key: keyof TripPersona): string[] {
    const v = persona?.[key];
    return v ? v.split(",").filter(Boolean) : [];
  }

  async function patchPersonaField(key: keyof TripPersona, value: string) {
    if (!activeId) return;
    setSavingKey(key);
    try {
      const res = await fetch(`${BACKEND}/conversations/${activeId}/persona`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      setPersona(data as TripPersona);
    } catch {}
    setSavingKey(null);
  }

  function handleSelect(key: keyof TripPersona, value: string, multi: boolean) {
    if (multi) {
      const current = getValues(key);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      patchPersonaField(key, next.join(","));
    } else {
      patchPersonaField(key, value);
      setExpandedKey(null);
    }
  }

  return (
    <div
      className={`flex flex-col dark:bg-gray-900 border-r border-black/10 dark:border-gray-700 h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? "w-14" : "w-64"
      }`}
      style={{ backgroundColor: "var(--t-sidebar-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-black/10 dark:border-gray-700 shrink-0">
        {!collapsed && (
          <span className="text-sm font-semibold text-[var(--t-primary)] truncate">🚗 RoadAI</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 ml-auto"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* New Chat button */}
      <div className="p-2 shrink-0">
        <button
          onClick={() => router.push("/chat")}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--t-primary)] hover:bg-[var(--t-primary-hover)] text-white text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""}`}
          title="New Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Scrollable middle: history + persona */}
      <div className="flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-0.5 px-2 py-1">
          {/* Main nav links */}
          <Link
            href="/chat"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/chat" || pathname.startsWith("/chat")
                ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)]"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            } ${collapsed ? "justify-center" : ""}`}
            title="Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {!collapsed && <span>Chat</span>}
          </Link>
          <Link
            href="/ask"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/ask"
                ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)]"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            } ${collapsed ? "justify-center" : ""}`}
            title="Ask RoadAI"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {!collapsed && <span>Ask RoadAI</span>}
          </Link>

          {/* Conversation history */}
          {!collapsed && conversations.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 pt-3 pb-1 group"
              >
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide group-hover:text-[var(--t-primary)] transition-colors">
                  History
                </p>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-3 h-3 text-gray-400 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {historyOpen && (
                <div className="overflow-y-auto flex flex-col gap-0.5" style={{ maxHeight: "calc(7 * 2.5rem)" }}>
                  {conversations.map((c) => (
                    <div key={c.id} className="shrink-0">
                      {renamingId === c.id ? (
                        <div className="flex items-center gap-1 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitRename(c.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => submitRename(c.id)}
                            className="flex-1 text-xs px-2 py-1 rounded-lg border border-[var(--t-primary)] outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      ) : (
                        <Link
                          href={`/chat?id=${c.id}`}
                          className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            activeId === c.id
                              ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)]"
                              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className="truncate flex-1">{c.title}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
                            <button
                              onClick={(e) => startRename(e, c.id, c.title)}
                              className="p-0.5 hover:text-[var(--t-primary)] transition-colors"
                              title="Rename"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, c.id)}
                              className="p-0.5 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Persona section ─────────────────────────────────── */}
          {!collapsed && activeId && (
            <div className="mt-4">
              {/* Section header */}
              <button
                onClick={() => setPersonaOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-1 group"
              >
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide group-hover:text-[var(--t-primary)] transition-colors">
                  Trip Persona
                </p>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-3 h-3 text-gray-400 transition-transform ${personaOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {personaOpen && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {persona === null && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 px-3 py-1 italic">
                      No persona set for this trip yet.
                    </p>
                  )}

                  {persona?.travelling_as === "meetup"
                    ? /* ── Meetup view ── */
                      MEETUP_DISPLAY_CATEGORIES.map((cat) => {
                        const isExpanded = expandedKey === cat.key;
                        const isSaving = savingKey === cat.key;
                        const rawVal = persona?.[cat.key] ?? "";
                        const isTextField = "text" in cat && cat.text;

                        return (
                          <div key={cat.key} className="px-1">
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : cat.key)}
                              className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 group-hover:text-[var(--t-primary)] transition-colors">
                                {cat.label}
                                {isSaving && <span className="ml-1 normal-case font-normal text-[var(--t-primary)] animate-pulse">saving…</span>}
                              </span>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {!isExpanded && (
                              <div className="px-2 pb-1">
                                {rawVal ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}>
                                    {isTextField
                                      ? (cat.key === "meet_date" && rawVal === "today" ? "📅 Today" : `📅 ${rawVal}`)
                                      : `${lookupEmoji(cat.options as any, rawVal)} ${lookupLabel(cat.options as any, rawVal)}`
                                    }
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Not set</span>
                                )}
                              </div>
                            )}

                            {isExpanded && (
                              <div className="px-2 pb-2 pt-1">
                                {isTextField ? (
                                  <div className="flex gap-1">
                                    <input
                                      type={cat.key === "meet_date" ? "date" : "text"}
                                      defaultValue={rawVal === "today" ? "" : rawVal}
                                      min={cat.key === "meet_date" ? new Date().toISOString().split("T")[0] : undefined}
                                      placeholder={cat.key === "meet_location" ? "e.g. Downtown Seattle…" : undefined}
                                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1 text-[10px] text-gray-900 dark:text-white dark:bg-gray-800 outline-none"
                                      onBlur={(e) => { if (e.target.value) { patchPersonaField(cat.key, e.target.value); setExpandedKey(null); } }}
                                      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLInputElement).value) { patchPersonaField(cat.key, (e.target as HTMLInputElement).value); setExpandedKey(null); } }}
                                    />
                                    {cat.key === "meet_date" && (
                                      <button
                                        onClick={() => { patchPersonaField(cat.key, "today"); setExpandedKey(null); }}
                                        className="text-[10px] px-2 py-1 rounded-full border font-semibold transition-all"
                                        style={{ borderColor: "var(--t-primary)", background: "var(--t-primary-light)", color: "var(--t-primary)" }}
                                      >
                                        Today
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {(cat.options as { value: string; emoji: string; label: string }[]).map((opt) => {
                                      const selected = rawVal === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          onClick={() => { patchPersonaField(cat.key, opt.value); setExpandedKey(null); }}
                                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold transition-all"
                                          style={{ borderColor: selected ? "var(--t-primary)" : "var(--accent, #e5e7eb)", background: selected ? "var(--t-primary-light)" : "transparent", color: selected ? "var(--t-primary)" : "var(--t-primary-text, #374151)" }}
                                        >
                                          <span>{opt.emoji}</span><span>{opt.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    : /* ── Standard trip view ── */
                      PERSONA_CATEGORIES.map((cat) => {
                        const vals = getValues(cat.key);
                        const isExpanded = expandedKey === cat.key;
                        const isSaving = savingKey === cat.key;

                        return (
                          <div key={cat.key} className="px-1">
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : cat.key)}
                              className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 group-hover:text-[var(--t-primary)] transition-colors">
                                {cat.label}
                                {isSaving && <span className="ml-1 normal-case font-normal text-[var(--t-primary)] animate-pulse">saving…</span>}
                              </span>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {!isExpanded && (
                              <div className="flex flex-wrap gap-1 px-2 pb-1">
                                {vals.length > 0 ? vals.map((v) => (
                                  <span key={v} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}>
                                    {lookupEmoji(cat.options as any, v)} {lookupLabel(cat.options as any, v)}
                                  </span>
                                )) : (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Not set</span>
                                )}
                              </div>
                            )}

                            {isExpanded && (
                              <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
                                {(cat.options as { value: string; emoji: string; label: string }[]).map((opt) => {
                                  const selected = vals.includes(opt.value);
                                  return (
                                    <button
                                      key={opt.value}
                                      onClick={() => handleSelect(cat.key, opt.value, cat.multi)}
                                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold transition-all"
                                      style={{ borderColor: selected ? "var(--t-primary)" : "var(--accent, #e5e7eb)", background: selected ? "var(--t-primary-light)" : "transparent", color: selected ? "var(--t-primary)" : "var(--t-primary-text, #374151)" }}
                                    >
                                      <span>{opt.emoji}</span><span>{opt.label}</span>
                                    </button>
                                  );
                                })}
                                {cat.multi && (
                                  <button onClick={() => setExpandedKey(null)} className="text-[10px] px-2 py-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    Done
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                  }
                  {persona && (
                    <div className="px-2 pt-2 pb-1">
                      <button
                        onClick={() => window.dispatchEvent(new Event("persona-try-now"))}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                        style={{ background: "var(--t-primary)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Try Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Bottom: settings + dark mode */}
      <div className="shrink-0 border-t border-black/10 dark:border-gray-700">
        <div className="px-2 pt-2 pb-1">
          <Link
            href="/settings"
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/settings"
                ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)]"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            } ${collapsed ? "justify-center" : ""}`}
            title="Profile & Trips"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {!collapsed && <span>Profile & Trips</span>}
          </Link>
        </div>
        <div className="p-3">
          <button
            onClick={toggleDark}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${collapsed ? "justify-center" : ""}`}
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
