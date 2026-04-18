"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MapView, { MapWaypoint } from "./MapView";
import PersonaSheet from "./PersonaSheet";
import MicButton from "./MicButton";
import PlaceModal from "./PlaceModal";
import { useVoiceInput } from "./useVoiceInput";
import { TripPersona, EMPTY_PERSONA } from "./personaConfig";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

const THEME_GREETINGS: Record<string, string> = {
  spring:  "The world is blooming — where will you wander this season? 🌸",
  summer:  "Sun's out, bags out. Where are we headed? ☀️",
  autumn:  "Golden roads are calling. What's your next destination? 🍂",
  winter:  "Cold outside, warm adventures ahead. Where to? ❄️",
  happy:   "Great vibes, great travels. Where's the next happy place? 😊",
  joyful:  "Let's make some memories! Where are you off to? 🎉",
  hot:     "Feeling bold? Let's plan something epic. Where to? 🔥",
  quirky:  "Something weird, wonderful, and unforgettable awaits. Where? 🪄",
  anime:   "Your journey begins here, traveller. Destination? ⛩️",
  kpop:    "Ready to make your trip legendary? Drop your destination 🎵",
  indian:  "Every journey is a new story. Where does yours begin? 🪔",
  mideast: "A thousand and one destinations await. Where shall we go? 🌙",
  viking:  "Chart the course. Where does the voyage take you? ⚔️",
  african: "The world is vast and wild. Where's the adventure? 🦁",
};

function getThemeGreeting() {
  if (typeof window === "undefined") return THEME_GREETINGS.spring;
  const theme = localStorage.getItem("season") ?? "spring";
  return THEME_GREETINGS[theme] ?? THEME_GREETINGS.spring;
}

const THINKING_PHRASES = [
  "Plotting your route...",
  "Checking hidden gems...",
  "Scanning local favourites...",
  "Mapping the best stops...",
  "Consulting the travel oracle...",
  "Packing the itinerary...",
  "Finding scenic detours...",
  "Calculating drive times...",
  "Discovering local eats...",
  "Sourcing insider tips...",
];

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
  onInfo: (place: PlaceLink) => void,
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
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.query || place.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--t-primary)] transition-colors"
              >
                {part}
              </a>
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
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfo(place); }}
                title="View on map"
                className="inline-flex items-center ml-0.5 align-middle transition-colors cursor-pointer text-gray-400 hover:text-[var(--t-primary)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: 13, height: 13 }}>
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
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

const SUGGESTED_PROMPTS = [
  "Plan a weekend road trip from my city",
  "Find the best restaurants near a landmark",
  "Plan a 3-day family trip with kids",
  "Suggest a spontaneous day trip nearby",
];

export default function ChatClient({
  userEmail,
  userImage,
  conversationId: initialConvId,
  autoPrompt,
}: {
  userEmail: string;
  userImage?: string;
  conversationId?: string;
  autoPrompt?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(0);
  const [modalPlace, setModalPlace] = useState<PlaceLink | null>(null);
  const [convId, setConvId] = useState<string | undefined>(initialConvId);
  const [title, setTitle] = useState("New Conversation");
  const [collapsedMaps, setCollapsedMaps] = useState<Set<number>>(new Set());
  const [savedMsgIds, setSavedMsgIds] = useState<Set<number>>(new Set());
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
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
        content: getThemeGreeting(),
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
            : [{ role: "assistant" as const, content: getThemeGreeting() }]
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

  useEffect(() => {
    if (!loading) return;
    setThinkingPhrase(Math.floor(Math.random() * THINKING_PHRASES.length));
    const interval = setInterval(() => {
      setThinkingPhrase((p) => (p + 1) % THINKING_PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

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

  function getFirstUserMessage() {
    const firstUserMessage = messages.find((m) => m.role === "user" && m.content.trim());
    if (!firstUserMessage) return "";
    return firstUserMessage.content.trim();
  }

  async function handleShare() {
    if (!convId || shareLoading) return;
    const query = getFirstUserMessage();
    if (!query) return;
    setShareError(null);
    setShareLoading(true);
    try {
      const res = await fetch(`${BACKEND}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: convId,
          user_email: userEmail,
          query,
        }),
      });
      if (!res.ok) {
        let detail = "Failed to create share link.";
        try {
          const err = await res.json();
          if (typeof err?.detail === "string" && err.detail.trim()) detail = err.detail;
        } catch {}
        throw new Error(detail);
      }
      const data = await res.json();
      const nextUrl = data.share_url as string;
      setShareUrl(nextUrl);
      await navigator.clipboard.writeText(nextUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create share link. Please try again.");
    }
    setShareLoading(false);
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
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-[var(--t-primary-text)] dark:text-gray-200 truncate">{title}</h1>
            {persona?.travelling_as && (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize" style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}>
                {persona.travelling_as}
              </span>
            )}
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
            <button
              onClick={handleShare}
              disabled={!convId || shareLoading || !messages.some((m) => m.role === "user" && m.content.trim())}
              className="flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--t-primary-light)] text-[var(--t-primary)] hover:opacity-85 font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              title="Create a shareable link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342A3 3 0 014.5 9.158l3.536-3.536a3 3 0 014.243 4.243L10.5 11.644m2.999-1.287a3 3 0 014.184 4.184l-3.536 3.536a3 3 0 01-4.243-4.243L13.5 12.356" />
              </svg>
              <span className="hidden sm:inline">
                {shareLoading ? "Sharing..." : shareCopied ? "Link copied!" : "Share"}
              </span>
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
        {shareUrl && (
          <div className="px-3 sm:px-6 py-2 border-b border-black/10 dark:border-gray-700 text-xs bg-white/70 dark:bg-gray-900/70">
            <span className="text-gray-500 dark:text-gray-400 mr-2">Share link:</span>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--t-primary)] underline break-all"
            >
              {shareUrl}
            </a>
          </div>
        )}
        {shareError && (
          <div className="px-3 sm:px-6 py-2 border-b border-black/10 dark:border-gray-700 text-xs text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/15">
            {shareError}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 space-y-6" style={{ background: "var(--t-chat-bg, var(--t-bg))" }}>

          {/* Suggested prompts — only show when just the greeting is visible */}
          {messages.length === 1 && messages[0].role === "assistant" && !loading && (
            <div className="flex flex-wrap gap-2 justify-center mt-2 mb-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); committedInputRef.current = p; }}
                  className="text-xs px-3 py-1.5 rounded-full border border-[var(--t-primary)] text-[var(--t-primary)] hover:bg-[var(--t-primary-light)] transition-colors font-medium"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

              {/* AI avatar */}
              {msg.role === "assistant" && (
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm mb-0.5" style={{ background: "var(--t-primary)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" opacity="0.4"/>
                    <path d="M12 3.5L13.6 10.8L12 9.8L10.4 10.8Z" fill="currentColor"/>
                    <path d="M12 20.5L10.4 13.2L12 14.2L13.6 13.2Z" fill="currentColor" opacity="0.4"/>
                    <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
                  </svg>
                </div>
              )}

              <div className="max-w-[88%] sm:max-w-[78%]">
                <div
                  className={`px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-[var(--t-bubble-user)] text-white rounded-2xl rounded-br-sm shadow-md"
                      : "text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-sm shadow-sm"
                  }`}
                  style={msg.role === "assistant" ? {
                    background: "var(--t-ai-bubble, white)",
                    border: "1px solid var(--t-primary-light, #e5e7eb)",
                  } : {}}
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
                          injectHearts(children, places, likedPlaceNames, setModalPlace, handleLikePlace);
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
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden shadow-sm mb-0.5">
                  {userImage ? (
                    <img src={userImage} alt="You" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--t-primary)" }}>
                      {userEmail[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              )}

            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2.5 justify-start">
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ background: "var(--t-primary)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" opacity="0.4"/>
                  <path d="M12 3.5L13.6 10.8L12 9.8L10.4 10.8Z" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
                </svg>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-3 min-w-[220px]"
                style={{ background: "var(--t-ai-bubble, white)", border: "1px solid var(--t-primary-light, #e5e7eb)" }}
              >
                {/* Spinning compass */}
                <svg
                  width="22" height="22" viewBox="0 0 24 24" fill="none"
                  className="shrink-0 text-[var(--t-primary)]"
                  style={{ animation: "spin 1.8s linear infinite" }}
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" opacity="0.3" />
                  <path d="M12 3.5L13.6 10.8L12 9.8L10.4 10.8Z" fill="currentColor" />
                  <path d="M12 20.5L10.4 13.2L12 14.2L13.6 13.2Z" fill="currentColor" opacity="0.35" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                </svg>
                {/* Cycling phrase */}
                <span
                  key={thinkingPhrase}
                  className="text-sm text-gray-500 dark:text-gray-400"
                  style={{ animation: "fadeIn 0.4s ease" }}
                >
                  {THINKING_PHRASES[thinkingPhrase]}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 safe-bottom" style={{ background: "var(--t-chat-bg, var(--t-bg))" }}>
          <div
            className="flex gap-2 items-end rounded-2xl px-3 py-2 shadow-lg"
            style={{
              background: "var(--t-topbar-bg)",
              border: "1px solid var(--t-primary-light, #e5e7eb)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}
          >
            <MicButton state={voice.state} onToggle={voice.toggle} />
            <textarea
              className={`flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-black dark:text-white placeholder-gray-400 focus:outline-none max-h-32 transition-colors ${
                voice.state === "listening" ? "text-red-500 dark:text-red-400" : ""
              }`}
              placeholder={voice.state === "listening" ? "Listening… speak your message" : "Where would you like to go?"}
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
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-30 hover:scale-105"
              style={{ background: "var(--t-primary)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        </div>

        {/* Place info modal */}
        {modalPlace && (
          <PlaceModal
            name={modalPlace.name}
            query={modalPlace.query || modalPlace.name}
            onClose={() => setModalPlace(null)}
          />
        )}

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
