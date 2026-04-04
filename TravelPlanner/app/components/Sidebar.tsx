"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeId = searchParams.get("id");

  const fetchConversations = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/conversations?user_email=${encodeURIComponent(userEmail)}`
      );
      const data = await res.json();
      setConversations(data);
    } catch {}
  }, [userEmail]);

  // Load dark mode preference
  useEffect(() => {
    setDark(localStorage.getItem("dark-mode") === "true");
  }, []);

  // Fetch conversations on mount and on custom event
  useEffect(() => {
    fetchConversations();
    window.addEventListener("conversation-updated", fetchConversations);
    return () => window.removeEventListener("conversation-updated", fetchConversations);
  }, [fetchConversations]);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("dark-mode", String(next));
    document.documentElement.classList.toggle("dark", next);
  }

  async function handleNewChat() {
    router.push("/chat");
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/conversations/${id}`, { method: "DELETE" });
    fetchConversations();
    if (activeId === id) router.push("/chat");
  }

  return (
    <div
      className={`flex flex-col dark:bg-gray-900 border-r border-black/10 dark:border-gray-700 h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? "w-14" : "w-60"
      }`}
      style={{ backgroundColor: "var(--t-sidebar-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-black/10 dark:border-gray-700">
        {!collapsed && (
          <span className="text-sm font-semibold text-[var(--t-primary)] truncate">
            🚗 RoadAI
          </span>
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
      <div className="p-2">
        <button
          onClick={handleNewChat}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--t-primary)] hover:bg-[var(--t-primary-hover)] text-white text-sm font-medium transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
          title="New Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Nav + Conversations */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1 overflow-y-auto">
        {/* Chat link (when on welcome page) */}
        {pathname !== "/chat" && (
          <Link
            href="/chat"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {!collapsed && <span className="text-sm">Chat</span>}
          </Link>
        )}

        {/* Conversation history */}
        {!collapsed && conversations.length > 0 && (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 pt-3 pb-1 uppercase tracking-wide">History</p>
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/chat?id=${c.id}`}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeId === c.id
                    ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)]"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span className="truncate">{c.title}</span>
                <button
                  onClick={(e) => handleDelete(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 shrink-0 ml-1"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Settings link */}
      <div className="px-2 pb-1 border-t border-black/10 dark:border-gray-700 pt-2">
        <Link
          href="/settings"
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/settings"
              ? "bg-[var(--t-sidebar-active)] text-[var(--t-sidebar-text)]"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          } ${collapsed ? "justify-center" : ""}`}
          title="Settings & Saved Trips"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {!collapsed && <span>Profile & Trips</span>}
        </Link>
      </div>

      {/* Dark mode toggle */}
      <div className="p-3 border-t border-black/10 dark:border-gray-700">
        <button
          onClick={toggleDark}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
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
  );
}
