"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MapView, { MapWaypoint } from "./MapView";
import PersonaSheet from "./PersonaSheet";
import MicButton from "./MicButton";
import { useVoiceInput } from "./useVoiceInput";
import { TripPersona, EMPTY_PERSONA } from "./personaConfig";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

function extractJsonArray(text: string, prefix: string): string | null {
  const idx = text.indexOf(prefix + ":");
  if (idx === -1) return null;
  const start = text.indexOf("[", idx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseWaypoints(text: string): MapWaypoint[] {
  const json = extractJsonArray(text, "TRAVELAI_LOCATIONS");
  if (!json) return [];
  try { return JSON.parse(json) as MapWaypoint[]; } catch { return []; }
}

interface TravelSegment {
  from: string;
  to: string;
  mode: "road" | "rail" | "ferry" | "air";
  time_hours: number;
  distance_miles: number | null;
}

function parseSegments(text: string): TravelSegment[] {
  const json = extractJsonArray(text, "TRAVELAI_SEGMENTS");
  if (!json) return [];
  try { return JSON.parse(json) as TravelSegment[]; } catch { return []; }
}

function stripMapBlock(text: string): string {
  return text
    .replace(/\n?TRAVELAI_LOCATIONS:[\s\S]*$/, "")
    .replace(/\n?TRAVELAI_PLACES:[\s\S]*$/, "")
    .replace(/\n?TRAVELAI_SEGMENTS:[\s\S]*$/, "")
    .replace(/\n?TRAVELAI_ITINERARY:[\s\S]*$/, "")
    .replace(/\n?TRAVELAI_EVENTS:[\s\S]*$/, "")
    .replace(/\n?TRAVELAI_NOTES:[\s\S]*$/, "")
    .replace(/\n?TRAVELAI_TRIP:[\s\S]*$/, "")
    .trimEnd();
}

interface PlaceLink {
  name: string;
  query: string;
  rating?: number;
  role?: string;
}

function parsePlaces(text: string): PlaceLink[] {
  const json = extractJsonArray(text, "TRAVELAI_PLACES");
  if (!json) return [];
  try { return JSON.parse(json) as PlaceLink[]; } catch { return []; }
}

// Walk React children (strings + arrays only — never recurse into elements to avoid double-injection)
// Each ReactMarkdown component renderer calls this on its own children independently.
function injectHearts(
  content: React.ReactNode,
  places: PlaceLink[],
  likedNames: Set<string>,
  onHeart: (p: PlaceLink) => void
): React.ReactNode {
  if (!places.length) return content;
  const placeMap = new Map(places.map((p) => [p.name, p]));

  function processString(text: string): React.ReactNode {
    const hits = places.filter((p) => text.includes(p.name));
    if (!hits.length) return text;
    const regex = new RegExp(
      `(${hits.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "g"
    );
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, idx) => {
          const place = placeMap.get(part);
          if (!place) return part;
          const liked = likedNames.has(place.name);
          return (
            <span key={idx} className="inline-flex items-center gap-0.5 align-baseline">
              {part}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHeart(place); }}
                title={liked ? "Remove from favourites" : "Save to favourites"}
                className="inline-flex items-center ml-0.5 align-middle transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={2.5}
                  style={{ width: 13, height: 13, color: liked ? "#ef4444" : "#9ca3af" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </span>
          );
        })}
      </>
    );
  }

  function process(node: React.ReactNode): React.ReactNode {
    if (typeof node === "string") return processString(node);
    // Process arrays of children (e.g. mixed text + elements inside a <p>)
    // but do NOT recurse into React elements — their own component renderer handles injection
    if (Array.isArray(node)) {
      return node.map((n, idx) =>
        typeof n === "string"
          ? <React.Fragment key={idx}>{processString(n)}</React.Fragment>
          : n
      );
    }
    return node;
  }

  return process(content);
}

export default function ChatClient({
  userEmail,
  conversationId: initialConvId,
  autoPrompt,
}: {
  userEmail: string;
  conversationId?: string;
  autoPrompt?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | undefined>(initialConvId);
  const [title, setTitle] = useState("New Conversation");
  const [collapsedMaps, setCollapsedMaps] = useState<Set<number>>(new Set());
  const [savedMsgIds, setSavedMsgIds] = useState<Set<number>>(new Set());
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [likedPlaceNames, setLikedPlaceNames] = useState<Set<string>>(new Set());
  const [likedPlaceIds, setLikedPlaceIds] = useState<Record<string, string>>({});
  // Track which message indices have been refined already (to avoid double-refine)
  const [refinedMsgIds, setRefinedMsgIds] = useState<Set<number>>(new Set());

  // DEV: system prompt debug panel
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [showPromptPanel, setShowPromptPanel] = useState(false);

  // Persona state
  const [persona, setPersona] = useState<TripPersona | null>(null);
  const [showPersonaSheet, setShowPersonaSheet] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const justCreatedRef = useRef(false);
  const router = useRouter();

  // Track the committed (non-interim) input so we can overlay interim text cleanly
  const committedInputRef = useRef("");
  // Ref holding the latest voice-send handler — updated each render to avoid stale closures
  const voiceSendRef = useRef<() => void>(() => {});

  const voice = useVoiceInput({
    onTranscript: (text) => {
      const next = committedInputRef.current ? committedInputRef.current + " " + text : text;
      committedInputRef.current = next;
      setInput(next);
    },
    onInterim: (text) => {
      setInput(committedInputRef.current ? committedInputRef.current + " " + text : text);
    },
    autoSend: true,
    onSend: () => voiceSendRef.current(),
    silenceMs: 4000,
  });

  // Load existing conversation (+ its persona)
  useEffect(() => {
    if (!initialConvId) {
      setMessages([{
        role: "assistant",
        content: "Hey! I'm your travel planning assistant ✈️ Where are you thinking of heading?",
      }]);
      setTitle("New Conversation");
      setPersona(null);
      if (autoPrompt) setInput(autoPrompt);
      // Eagerly create a conversation and show persona sheet immediately
      fetch(`${BACKEND}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail }),
      })
        .then((r) => r.json())
        .then((data) => {
          setConvId(data.id);
          justCreatedRef.current = true;
          router.replace(`/chat?id=${data.id}${autoPrompt ? `&prompt=${encodeURIComponent(autoPrompt)}` : ""}`);
          setShowPersonaSheet(true);
        })
        .catch(() => {});
      return;
    }
    if (justCreatedRef.current) {
      justCreatedRef.current = false;
      return;
    }
    fetch(`${BACKEND}/conversations/${initialConvId}`)
      .then((r) => r.json())
      .then((data) => {
        setConvId(data.id);
        setTitle(data.title);
        setMessages(
          data.messages.length > 0
            ? data.messages
            : [{ role: "assistant" as const, content: "Hey! I'm your travel planning assistant ✈️ Where are you thinking of heading?" }]
        );
        // Load persona for this trip
        const p = data.persona as TripPersona;
        const hasPersona = p && (p.travelling_as || p.travel_style || p.trip_length || p.interests || p.dietary);
        setPersona(hasPersona ? p : null);
        setShowPersonaSheet(false);
        // Pre-fill input if coming from /ask page
        if (autoPrompt) setInput(autoPrompt);
      })
      .catch(() => {});
  }, [initialConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get user's current location on mount for new conversations
  useEffect(() => {
    if (initialConvId) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || data.display_name?.split(",")[0];
          const state = data.address?.state ?? "";
          const country = data.address?.country ?? "";
          const location = [city, state, country].filter(Boolean).join(", ");
          if (location) setUserLocation(location);
        } catch {}
      },
      () => {}
    );
  }, [initialConvId]);


  // Load user's liked places on mount
  useEffect(() => {
    if (!userEmail) return;
    fetch(`${BACKEND}/liked-places?user_email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => {
        setLikedPlaceNames(new Set(data.map((p) => p.name)));
        setLikedPlaceIds(Object.fromEntries(data.map((p) => [p.name, p.id])));
      })
      .catch(() => {});
  }, [userEmail]);

  async function handleLikePlace(place: PlaceLink) {
    const isLiked = likedPlaceNames.has(place.name);
    if (isLiked) {
      const id = likedPlaceIds[place.name];
      if (!id) return;
      await fetch(`${BACKEND}/liked-places/${id}`, { method: "DELETE" });
      setLikedPlaceNames((prev) => { const s = new Set(prev); s.delete(place.name); return s; });
      setLikedPlaceIds((prev) => { const m = { ...prev }; delete m[place.name]; return m; });
    } else {
      const res = await fetch(`${BACKEND}/liked-places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail, name: place.name, query: place.query, category: place.role ?? null, rating: place.rating ? String(place.rating) : null }),
      });
      const data = await res.json();
      setLikedPlaceNames((prev) => new Set([...prev, place.name]));
      setLikedPlaceIds((prev) => ({ ...prev, [place.name]: data.id }));
    }
  }

  function handleRefineWithPicks(msgIndex: number, msgContent: string) {
    if (!convId || loading) return;
    const places = parsePlaces(msgContent);
    const liked = places.filter((p) => likedPlaceNames.has(p.name));
    if (liked.length === 0) return;

    const likedList = liked.map((p) => p.name).join(", ");
    const text = `I liked these from your suggestions: ${likedList}. Based on what I picked, can you refine and tailor your recommendations — more options like these, with similar vibe, category, and quality? Make it personal to my taste.`;

    setRefinedMsgIds((prev) => new Set([...prev, msgIndex]));
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    streamMessage(text, convId);
  }

  // Listen for "Try Now" from sidebar persona section
  useEffect(() => {
    function onTryNow() {
      if (!convId || loading) return;
      const text = "Based on my updated travel preferences, can you refine your suggestions?";
      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      streamMessage(text, convId);
    }
    window.addEventListener("persona-try-now", onTryNow);
    return () => window.removeEventListener("persona-try-now", onTryNow);
  }, [convId, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const currentConvId = convId;
      if (!currentConvId) {
        setLoading(false);
        return;
      }
      await streamMessage(text, currentConvId);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
      setLoading(false);
    }
  }

  async function streamMessage(text: string, currentConvId: string, voiceMode = false) {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/conversations/${currentConvId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, user_email: userEmail, user_location: userLocation ?? undefined, ...(voiceMode && { voice_mode: true }) }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            if (event.type === "system_prompt") {
              setSystemPrompt(event.text);
            } else if (event.type === "chunk") {
              fullText += event.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullText };
                return updated;
              });
            } else if (event.type === "done") {
              if (event.title) setTitle(event.title);
              window.dispatchEvent(new Event("conversation-updated"));
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // Keep the ref up-to-date every render so voice auto-send always uses latest state
  voiceSendRef.current = () => {
    const text = committedInputRef.current.trim();
    if (!text || loading) return;
    const currentConvId = convId;
    if (!currentConvId) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    committedInputRef.current = "";
    setLoading(true);
    streamMessage(text, currentConvId, true);
  };

  function handlePersonaComplete(completed: TripPersona, autoMessage?: string) {
    setPersona(completed);
    setShowPersonaSheet(false);
    if (autoMessage && convId) {
      const userMsg: Message = { role: "user", content: autoMessage };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      streamMessage(autoMessage, convId);
    }
  }

  function handlePersonaSkip() {
    setShowPersonaSheet(false);
    setPersona(EMPTY_PERSONA);
  }

  const handleSaveTrip = useCallback(async (idx: number) => {
    const msg = messages[idx];
    if (!msg || savedMsgIds.has(idx)) return;
    setSavingIdx(idx);
    const cleanContent = stripMapBlock(msg.content);
    const firstLine = cleanContent.split("\n").find((l) => l.trim()) ?? "Saved Trip";
    const tripTitle = firstLine.replace(/^#+\s*/, "").slice(0, 60);
    try {
      await fetch(`${BACKEND}/saved-trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail, conversation_id: convId ?? null, title: tripTitle, content: cleanContent }),
      });
      setSavedMsgIds((prev) => new Set(prev).add(idx));
    } catch {}
    setSavingIdx(null);
  }, [messages, savedMsgIds, userEmail, convId]);

  function handleExport() {
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "TravelAI"}: ${stripMapBlock(m.content)}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    });
  }

  function handlePrint() {
    const rows = messages
      .filter((m) => m.content.trim())
      .map((m) => {
        const label = m.role === "user" ? "You" : "TravelAI";
        const content = stripMapBlock(m.content)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/\n/g, "<br/>");
        const bubbleStyle = m.role === "user"
          ? "background:#e8f5e2;text-align:right;border-radius:16px 16px 4px 16px;"
          : "background:#f9f9f9;border:1px solid #e5e7eb;border-radius:16px 16px 16px 4px;";
        return `<div style="margin-bottom:16px;"><div style="font-size:10px;color:#888;margin-bottom:4px;${m.role === "user" ? "text-align:right;" : ""}">${label}</div><div style="display:inline-block;max-width:80%;padding:12px 16px;font-size:14px;line-height:1.6;${bubbleStyle}">${content}</div></div>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;}
      h1{font-size:20px;margin-bottom:4px;}p.sub{font-size:12px;color:#888;margin-bottom:32px;}
      h1,h2,h3{margin:8px 0 4px;}
      @media print{body{margin:20px;}}
    </style></head><body>
      <h1>${title}</h1>
      <p class="sub">TravelAI · ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
      ${rows}
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  }

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%", minHeight: 0 }}>

      {/* ── Chat column ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0, position: "relative" }}>

        {/* Header */}
        <div
          className="border-b border-black/10 dark:bg-gray-900 dark:border-gray-700 px-3 sm:px-6 py-3 flex items-center justify-between shrink-0 gap-2"
          style={{ backgroundColor: "var(--t-topbar-bg)" }}
        >
          <div>
            <h1 className="text-sm font-semibold text-[var(--t-primary-text)] dark:text-gray-200">{title}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-500">Road trip assistant · AI Powered</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
              title="Copy chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">{exportCopied ? "Copied!" : "Copy"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
              title="Print chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="hidden sm:inline">Print</span>
            </button>
            {/* DEV: system prompt debug toggle */}
            <button
              onClick={() => setShowPromptPanel((v) => !v)}
              title="DEV: View system prompt"
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                showPromptPanel
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Prompt
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[90%] sm:max-w-[75%]">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-[var(--t-bubble-user)] text-white rounded-br-sm"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <>
                      {/* Inline collapsible map — shown when this message has waypoints */}
                      {parseWaypoints(msg.content).length > 0 && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-black/10 dark:border-gray-700">
                          <button
                            onClick={() => setCollapsedMaps((prev) => {
                              const next = new Set(prev);
                              next.has(i) ? next.delete(i) : next.add(i);
                              return next;
                            })}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
                            style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}
                          >
                            <span className="flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />
                              </svg>
                              Route Map · {parseWaypoints(msg.content).length} stops
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${collapsedMaps.has(i) ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {!collapsedMaps.has(i) && (
                            <div style={{ height: 300 }}>
                              <MapView waypoints={parseWaypoints(msg.content)} />
                            </div>
                          )}
                        </div>
                      )}
                      {(() => {
                        const places = parsePlaces(msg.content);
                        const likedInMsg = places.filter((p) => likedPlaceNames.has(p.name));
                        const alreadyRefined = refinedMsgIds.has(i);
                        const H = (children: React.ReactNode) =>
                          injectHearts(children, places, likedPlaceNames, handleLikePlace);
                        return (
                          <>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{H(children)}</h1>,
                                h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1">{H(children)}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-0.5">{H(children)}</h3>,
                                p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{H(children)}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{H(children)}</li>,
                                strong: ({ children }) => <strong className="font-semibold">{H(children)}</strong>,
                                em:     ({ children }) => <em className="italic">{H(children)}</em>,
                                hr: () => <hr className="my-2 border-gray-200 dark:border-gray-600" />,
                                code: ({ children }) => (
                                  <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                ),
                              }}
                            >
                              {stripMapBlock(msg.content)}
                            </ReactMarkdown>
                            {/* Refine button — appears below message when ≥1 hearted place in this message */}
                            {likedInMsg.length > 0 && !loading && (
                              <button
                                onClick={() => handleRefineWithPicks(i, msg.content)}
                                disabled={alreadyRefined}
                                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                                style={{
                                  background: alreadyRefined ? "var(--t-primary-light)" : "var(--t-primary)",
                                  color: alreadyRefined ? "var(--t-primary)" : "white",
                                  opacity: alreadyRefined ? 0.7 : 1,
                                  cursor: alreadyRefined ? "default" : "pointer",
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                                {alreadyRefined
                                  ? `Refined with ${likedInMsg.length} pick${likedInMsg.length > 1 ? "s" : ""}`
                                  : `Refine with my ${likedInMsg.length} pick${likedInMsg.length > 1 ? "s" : ""}`
                                }
                                {!alreadyRefined && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>

                {msg.role === "assistant" && msg.content && !loading && (
                  <div className="flex items-center gap-2 mt-1.5 pl-1">
                    <button
                      onClick={() => handleSaveTrip(i)}
                      disabled={savedMsgIds.has(i) || savingIdx === i}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        savedMsgIds.has(i)
                          ? "bg-[var(--t-primary-light)] text-[var(--t-primary)]"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-[var(--t-primary-light)] hover:text-[var(--t-primary)]"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill={savedMsgIds.has(i) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      {savingIdx === i ? "Saving…" : savedMsgIds.has(i) ? "Saved!" : "Save trip"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                <span className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="border-t border-black/10 dark:bg-gray-900 dark:border-gray-700 px-3 sm:px-6 py-3 sm:py-4 shrink-0 safe-bottom"
          style={{ backgroundColor: "var(--t-topbar-bg)" }}
        >
          <div className="flex gap-2 items-end">
            <MicButton state={voice.state} onToggle={voice.toggle} />
            <textarea
              className={`flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm text-black dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--t-ring)] max-h-32 transition-colors ${
                voice.state === "listening"
                  ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-gray-800"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder={voice.state === "listening" ? "Listening… speak your message" : "Ask about your trip…"}
              rows={1}
              value={input}
              onChange={(e) => { committedInputRef.current = e.target.value; setInput(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-[var(--t-primary)] hover:bg-[var(--t-primary-hover)] disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Enter to send · Shift+Enter for new line</p>
        </div>

        {/* Persona Sheet overlay */}
        {showPersonaSheet && convId && (
          <PersonaSheet
            userEmail={userEmail}
            conversationId={convId}
            onComplete={handlePersonaComplete}
            onSkip={handlePersonaSkip}
          />
        )}
      </div>

      {/* DEV: System Prompt debug panel */}
      {showPromptPanel && (
        <div className="w-96 shrink-0 flex flex-col border-l border-amber-200 bg-amber-50 dark:bg-gray-950 dark:border-amber-900 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200 dark:border-amber-900 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">DEV · System Prompt</span>
              {systemPrompt && (
                <span className="text-[10px] text-amber-500">{systemPrompt.length} chars</span>
              )}
            </div>
            <button
              onClick={() => { if (systemPrompt) { navigator.clipboard.writeText(systemPrompt); } }}
              className="text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 transition-colors"
            >
              Copy
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {systemPrompt ? (
              <pre className="text-[11px] font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {systemPrompt}
              </pre>
            ) : (
              <p className="text-xs text-amber-400 italic mt-2">Send a message to capture the system prompt.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
