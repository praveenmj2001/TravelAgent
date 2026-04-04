"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MapView, { MapWaypoint } from "./MapView";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

function parseWaypoints(text: string): MapWaypoint[] {
  const match = text.match(/ROADAI_MAP:(\[[\s\S]*?\])(?:\s*$)/m);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as MapWaypoint[];
  } catch {
    return [];
  }
}

function stripMapBlock(text: string): string {
  return text.replace(/\nROADAI_MAP:\[[\s\S]*?\](\s*)$/m, "").trimEnd();
}

export default function ChatClient({
  userEmail,
  conversationId: initialConvId,
}: {
  userEmail: string;
  conversationId?: string;
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const justCreatedRef = useRef(false);
  const router = useRouter();

  // Load existing conversation
  useEffect(() => {
    if (!initialConvId) {
      setMessages([{
        role: "assistant",
        content: "Hey! I'm your road trip planning assistant 🚗 Where are you thinking of heading?",
      }]);
      setTitle("New Conversation");
      setConvId(undefined);
      return;
    }
    // Skip reload if we just created this conversation ourselves (stream is in progress)
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
            : [{
                role: "assistant" as const,
                content: "Hey! I'm your road trip planning assistant 🚗 Where are you thinking of heading?",
              }]
        );
      })
      .catch(() => {});
  }, [initialConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update map whenever messages change — show waypoints from the last assistant message that has them
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

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      let currentConvId = convId;
      if (!currentConvId) {
        const res = await fetch(`${BACKEND}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_email: userEmail }),
        });
        const data = await res.json();
        currentConvId = data.id;
        setConvId(currentConvId);
        justCreatedRef.current = true;
        router.replace(`/chat?id=${currentConvId}`);
      }

      // Start streaming
      const res = await fetch(`${BACKEND}/conversations/${currentConvId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, user_email: userEmail }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      // Add empty assistant message to fill in
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
            if (event.type === "chunk") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + event.text,
                };
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
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
        body: JSON.stringify({
          user_email: userEmail,
          conversation_id: convId ?? null,
          title: tripTitle,
          content: cleanContent,
        }),
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
    window.print();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div
        className="border-b border-black/10 dark:bg-gray-900 dark:border-gray-700 px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: "var(--t-topbar-bg)" }}
      >
        <div>
          <h1 className="text-sm font-semibold text-[var(--t-primary-text)] dark:text-gray-200">{title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-500">Road trip assistant · Powered by Claude</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Map toggle */}
          {activeWaypoints.length > 0 && (
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                showMap
                  ? "bg-[var(--t-primary)] text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              title="Toggle map"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />
              </svg>
              Map
            </button>
          )}
          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
            title="Copy conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {exportCopied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
            title="Print trip"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Map panel */}
      {showMap && activeWaypoints.length > 0 && (
        <div className="px-6 pt-3 pb-1 bg-white dark:bg-gray-900 border-b border-black/10 dark:border-gray-700">
          <MapView waypoints={activeWaypoints} />
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
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        hr: () => <hr className="my-2 border-gray-200 dark:border-gray-600" />,
                        code: ({ children }) => (
                          <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                        ),
                      }}
                    >
                      {stripMapBlock(msg.content)}
                    </ReactMarkdown>

                    {/* Inline map for this message */}
                    {parseWaypoints(msg.content).length > 0 && (
                      <MapView waypoints={parseWaypoints(msg.content)} />
                    )}
                  </>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>

              {/* Action bar below assistant messages */}
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
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="border-t border-black/10 dark:bg-gray-900 dark:border-gray-700 px-6 py-4"
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
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
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
    </div>
  );
}
