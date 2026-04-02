"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

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
  const bottomRef = useRef<HTMLDivElement>(null);
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

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Create conversation if this is the first real message
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
        router.replace(`/chat?id=${currentConvId}`);
      }

      // Send message
      const res = await fetch(`${BACKEND}/conversations/${currentConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, user_email: userEmail }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      if (data.title) setTitle(data.title);

      // Notify sidebar to refresh
      window.dispatchEvent(new Event("conversation-updated"));
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">Road trip assistant · Powered by Claude</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
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
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
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
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-black dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 max-h-32"
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
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
