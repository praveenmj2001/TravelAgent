"use client";

import Link from "next/link";
import TravelAILogo from "./TravelAILogo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  TripPersona,
  PERSONA_CATEGORIES,
  MEETUP_DISPLAY_CATEGORIES,
  SPONTANEOUS_DISPLAY_CATEGORIES,
  lookupEmoji,
  lookupLabel,
} from "@/app/chat/personaConfig";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
const MAX_HISTORY = 7;

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ConversationGroup {
  label: string;
  items: Conversation[];
}

function groupByDate(convs: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  const buckets: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };

  for (const c of convs) {
    const d = new Date(c.updated_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= todayStart) buckets["Today"].push(c);
    else if (day >= yesterdayStart) buckets["Yesterday"].push(c);
    else if (day >= weekStart) buckets["This Week"].push(c);
    else buckets["Older"].push(c);
  }

  return (["Today", "Yesterday", "This Week", "Older"] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0);
}

export default function Sidebar({
  userEmail,
  userName,
  userImage,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  userEmail: string;
  userName?: string;
  userImage?: string;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const [dark, setDark] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [persona, setPersona] = useState<TripPersona | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

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

  useEffect(() => {
    if (activeId) {
      fetchPersona(activeId);
      setExpandedKey(null);
    } else {
      setPersona(null);
    }
  }, [activeId, fetchPersona]);

  useEffect(() => {
    function onPersonaUpdated() {
      if (activeId) fetchPersona(activeId);
    }
    window.addEventListener("persona-updated", onPersonaUpdated);
    return () => window.removeEventListener("persona-updated", onPersonaUpdated);
  }, [activeId, fetchPersona]);

  // Reset show-all when search changes
  useEffect(() => {
    setShowAllHistory(false);
  }, [searchQuery]);

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

  // Derived: filtered + grouped conversations
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const showAll = searchQuery.length > 0 || showAllHistory;
  const displayed = showAll ? filtered : filtered.slice(0, MAX_HISTORY);
  const hasMore = !showAll && filtered.length > MAX_HISTORY;
  const groups = groupByDate(displayed);

  // Persona summary chips (top 2-3 key fields)
  function getPersonaSummaryChips(): { emoji: string; label: string }[] {
    if (!persona) return [];
    const chips: { emoji: string; label: string }[] = [];

    if (persona.travelling_as) {
      const allOptions = [...PERSONA_CATEGORIES, ...SPONTANEOUS_DISPLAY_CATEGORIES, ...MEETUP_DISPLAY_CATEGORIES];
      const travellingAsOptions = allOptions.find((c) => c.key === "travelling_as")?.options ?? [];
      const e = lookupEmoji(travellingAsOptions as any, persona.travelling_as);
      const l = lookupLabel(travellingAsOptions as any, persona.travelling_as);
      if (l) chips.push({ emoji: e, label: l });
    }

    if (persona.travel_style) {
      const cat = PERSONA_CATEGORIES.find((c) => c.key === "travel_style");
      const vals = persona.travel_style.split(",").filter(Boolean).slice(0, 1);
      for (const v of vals) {
        const e = lookupEmoji(cat?.options as any, v);
        const l = lookupLabel(cat?.options as any, v);
        if (l) chips.push({ emoji: e, label: l });
      }
    }

    if (persona.trip_length && chips.length < 3) {
      const cat = PERSONA_CATEGORIES.find((c) => c.key === "trip_length");
      const e = lookupEmoji(cat?.options as any, persona.trip_length);
      const l = lookupLabel(cat?.options as any, persona.trip_length);
      if (l) chips.push({ emoji: e, label: l });
    }

    return chips.slice(0, 3);
  }

  const personaChips = getPersonaSummaryChips();

  // User display helpers
  const displayName = userName || userEmail.split("@")[0];
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div
      className={`flex flex-col dark:bg-gray-900 border-r border-black/10 dark:border-gray-700 h-screen transition-all duration-300 ${
        collapsed ? "w-14" : "w-64"
      }`}
      style={{ backgroundColor: "var(--t-sidebar-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-black/10 dark:border-gray-700 shrink-0">
        {!collapsed && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--t-primary)] truncate">
            <TravelAILogo size={18} />
            TravelAI
          </span>
        )}
        <button
          onClick={onToggleCollapsed}
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
          onClick={() => { router.push("/chat"); onClose?.(); }}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--t-primary)] hover:bg-[var(--t-primary-hover)] text-white text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""}`}
          title="New Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Scrollable middle: nav + history + persona */}
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
            title="Ask TravelAI"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {!collapsed && <span>Ask TravelAI</span>}
          </Link>

          {/* Conversation history */}
          {!collapsed && conversations.length > 0 && (
            <div className="mt-1">
              {/* Section header */}
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
                <>
                  {/* Search bar */}
                  <div className="px-2 pb-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chats…"
                        className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none min-w-0"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grouped results */}
                  {groups.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 italic">No chats found.</p>
                  ) : (
                    <div className="flex flex-col">
                      {groups.map((group) => (
                        <div key={group.label}>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 pt-2 pb-0.5 font-semibold">
                            {group.label}
                          </p>
                          {group.items.map((c) => (
                            <div key={c.id} className="shrink-0 px-1">
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
                                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all border-l-2 ${
                                    activeId === c.id
                                      ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)] border-[var(--t-primary)]"
                                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent"
                                  }`}
                                >
                                  <span className="truncate flex-1 text-xs">{c.title}</span>
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
                      ))}
                    </div>
                  )}

                  {/* Show more / Show less */}
                  {(hasMore || showAllHistory) && !searchQuery && (
                    <button
                      onClick={() => setShowAllHistory((v) => !v)}
                      className="w-full text-left px-4 py-1.5 text-xs text-[var(--t-primary)] hover:underline transition-colors"
                    >
                      {showAllHistory ? "Show less" : `Show ${filtered.length - MAX_HISTORY} more…`}
                    </button>
                  )}
                </>
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

              {/* Compact summary chips — shown when section is collapsed */}
              {!personaOpen && personaChips.length > 0 && (
                <div className="flex flex-wrap gap-1 px-3 pb-2 pt-1">
                  {personaChips.map((chip, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}
                    >
                      {chip.emoji} {chip.label}
                    </span>
                  ))}
                </div>
              )}

              {!personaOpen && persona === null && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 px-3 py-1 italic">No persona set.</p>
              )}

              {personaOpen && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {persona === null && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 px-3 py-1 italic">
                      No persona set for this trip yet.
                    </p>
                  )}

                  {persona?.travelling_as === "spontaneous"
                    ? SPONTANEOUS_DISPLAY_CATEGORIES.map((cat) => {
                        const isExpanded = expandedKey === cat.key;
                        const isSaving = savingKey === cat.key;
                        const rawVal = persona?.[cat.key] ?? "";
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
                                    {lookupEmoji(cat.options as any, rawVal)} {lookupLabel(cat.options as any, rawVal)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Not set</span>
                                )}
                              </div>
                            )}
                            {isExpanded && (
                              <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
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
                        );
                      })
                    : persona?.travelling_as === "meetup"
                    ? MEETUP_DISPLAY_CATEGORIES.map((cat) => {
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
                    : PERSONA_CATEGORIES.map((cat) => {
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

      {/* Bottom: user profile card + dark mode */}
      <div className="shrink-0 border-t border-black/10 dark:border-gray-700">
        {/* User profile card */}
        <div className="px-2 pt-2">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? displayName : undefined}
          >
            {/* Avatar */}
            <div className="shrink-0">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt={displayName}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-[var(--t-primary-light)]"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "var(--t-primary)" }}
                >
                  {initials}
                </div>
              )}
            </div>
            {/* Name + email */}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{displayName}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">{userEmail}</p>
              </div>
            )}
            {/* Settings cog */}
            {!collapsed && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </Link>
        </div>

        {/* Dark mode toggle */}
        <div className="p-2 pt-1">
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
