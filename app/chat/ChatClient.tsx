"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MapView, { MapWaypoint } from "./MapView";
import PersonaSheet from "./PersonaSheet";
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
  const json = extractJsonArray(text, "ROADAI_MAP");
  if (!json) return [];
  try { return JSON.parse(json) as MapWaypoint[]; } catch { return []; }
}

function stripMapBlock(text: string): string {
  return text
    .replace(/\n?ROADAI_MAP:[\s\S]*$/, "")
    .replace(/\n?ROADAI_PLACES:[\s\S]*$/, "")
    .trimEnd();
}

interface PlaceLink {
  name: string;
  query: string;
  rating?: number;
}

function parsePlaces(text: string): PlaceLink[] {
  const json = extractJsonArray(text, "ROADAI_PLACES");
  if (!json) return [];
  try { return JSON.parse(json) as PlaceLink[]; } catch { return []; }
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
  const [showMap, setShowMap] = useState(false);
  const [activeWaypoints, setActiveWaypoints] = useState<MapWaypoint[]>([]);
  const [savedMsgIds, setSavedMsgIds] = useState<Set<number>>(new Set());
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [userLocation, setUserLocation] = useState<string | null>(null);

  // DEV: system prompt debug panel
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [showPromptPanel, setShowPromptPanel] = useState(false);

  // Persona state
  const [persona, setPersona] = useState<TripPersona | null>(null);
  const [showPersonaSheet, setShowPersonaSheet] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const justCreatedRef = useRef(false);
  const router = useRouter();

  // Load existing conversation (+ its persona)
  useEffect(() => {
    if (!initialConvId) {
      setMessages([{
        role: "assistant",
        content: "Hey! I'm your road trip planning assistant 🚗 Where are you thinking of heading?",
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
            : [{ role: "assistant" as const, content: "Hey! I'm your road trip planning assistant 🚗 Where are you thinking of heading?" }]
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

  // Update map from latest assistant message with waypoints
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        const wps = parseWaypoints(messages[i].content);
        if (wps.length > 0) {
          setActiveWaypoints(wps);
          return;
        }
      }
    }
    setActiveWaypoints([]);
  }, [messages]);

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

  async function streamMessage(text: string, currentConvId: string) {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/conversations/${currentConvId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, user_email: userEmail, user_location: userLocation ?? undefined }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: updated[updated.length - 1].content + event.text };
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
      .map((m) => `${m.role === "user" ? "You" : "RoadAI"}: ${stripMapBlock(m.content)}`)
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
        const label = m.role === "user" ? "You" : "RoadAI";
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
      <p class="sub">RoadAI · ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
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
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
    <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Header */}
        <div
          className="border-b border-black/10 dark:bg-gray-900 dark:border-gray-700 px-6 py-3 flex items-center justify-between shrink-0"
          style={{ backgroundColor: "var(--t-topbar-bg)" }}
        >
          <div>
            <h1 className="text-sm font-semibold text-[var(--t-primary-text)] dark:text-gray-200">{title}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-500">Road trip assistant · AI Powered</p>
          </div>
          <div className="flex items-center gap-2">
            {activeWaypoints.length > 0 && (
              <button
                onClick={() => setShowMap((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  showMap ? "bg-[var(--t-primary)] text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />
                </svg>
                Map
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {exportCopied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
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

        {/* Map panel */}
        {showMap && activeWaypoints.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border-b border-black/10 dark:border-gray-700 shrink-0">
            <div className="px-4 pb-2 pt-2">
              <MapView waypoints={activeWaypoints} />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%]">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-[var(--t-bubble-user)] text-white rounded-br-sm"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-0.5">{children}</h3>,
                          p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em:     ({ children }) => <em className="italic">{children}</em>,
                          hr: () => <hr className="my-2 border-gray-200 dark:border-gray-600" />,
                          code: ({ children }) => (
                            <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                          ),
                        }}
                      >
                        {stripMapBlock(msg.content)}
                      </ReactMarkdown>
                      {parseWaypoints(msg.content).length > 0 && (
                        <MapView waypoints={parseWaypoints(msg.content)} />
                      )}
                      {parsePlaces(msg.content).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {parsePlaces(msg.content).map((place) => (
                            <a
                              key={place.name}
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.query)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-md hover:-translate-y-0.5"
                              style={{
                                borderColor: "var(--t-primary)",
                                color: "var(--t-primary)",
                                background: "var(--t-primary-light, #f0fdf4)",
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {place.name}
                              {place.rating && (
                                <span className="opacity-70">⭐ {place.rating}</span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
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
          className="border-t border-black/10 dark:bg-gray-900 dark:border-gray-700 px-6 py-4 shrink-0"
          style={{ backgroundColor: "var(--t-topbar-bg)" }}
        >
          <div className="flex gap-3 items-end">
            <textarea
              className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-black dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--t-ring)] max-h-32"
              placeholder="Ask about your road trip..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
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

        {/* Persona Sheet overlay (bottom sheet, anchored to this column) */}
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
            onClick={() => {
              if (systemPrompt) { navigator.clipboard.writeText(systemPrompt); }
            }}
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
