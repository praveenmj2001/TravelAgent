"use client";

import { useEffect, useRef, useState } from "react";

const THEME_GROUPS = [
  {
    label: "🍃 Seasons",
    themes: [
      { key: "spring",  emoji: "🌸", name: "Spring" },
      { key: "summer",  emoji: "☀️", name: "Summer" },
      { key: "autumn",  emoji: "🍂", name: "Autumn" },
      { key: "winter",  emoji: "❄️", name: "Winter" },
    ],
  },
  {
    label: "🎭 Moods",
    themes: [
      { key: "happy",   emoji: "😊", name: "Happy" },
      { key: "joyful",  emoji: "🎉", name: "Joyful" },
      { key: "hot",     emoji: "🔥", name: "Hot" },
      { key: "quirky",  emoji: "🪄", name: "Quirky" },
    ],
  },
  {
    label: "🌍 Cultural",
    themes: [
      { key: "anime",   emoji: "⛩️", name: "Anime" },
      { key: "kpop",    emoji: "🎵", name: "K-Pop" },
      { key: "indian",  emoji: "🪔", name: "Indian" },
      { key: "mideast", emoji: "🌙", name: "Mid East" },
      { key: "viking",  emoji: "⚔️", name: "Viking" },
      { key: "african", emoji: "🦁", name: "African" },
    ],
  },
] as const;

const ALL_THEMES = THEME_GROUPS.flatMap((g) => g.themes);
const DARK_BG_THEMES = new Set(["anime", "hot", "indian", "mideast", "viking"]);

function getDefaultSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

export default function ThemeSwitcher({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [active, setActive] = useState("spring");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("season") ?? getDefaultSeason();
    setActive(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function switchTheme(key: string) {
    const html = document.documentElement;
    // Remove all theme classes from <html>
    ALL_THEMES.forEach((t) => html.classList.remove(`theme-${t.key}`));
    html.classList.add(`theme-${key}`);
    html.setAttribute("data-theme", key);

    // Dark-bg themes also activate Tailwind dark mode
    const userDark = localStorage.getItem("dark-mode") === "true";
    if (DARK_BG_THEMES.has(key)) {
      html.classList.add("dark");
    } else if (!userDark) {
      html.classList.remove("dark");
    }

    localStorage.setItem("season", key);
    setActive(key);
    setOpen(false);
  }

  const current = ALL_THEMES.find((t) => t.key === active) ?? ALL_THEMES[0];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all backdrop-blur-sm border ${
          variant === "dark"
            ? "bg-black/10 hover:bg-black/20 text-white border-white/20"
            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
        }`}
        title="Switch theme"
      >
        <span className="text-sm leading-none">{current.emoji}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-3 z-[9999]">
          {THEME_GROUPS.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 px-1">
                {group.label}
              </p>
              <div className="grid grid-cols-4 gap-1">
                {group.themes.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => switchTheme(t.key)}
                    className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                      active === t.key
                        ? "bg-[var(--accent)] text-[var(--primary)] ring-2 ring-[var(--primary)] scale-105"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                    }`}
                    title={t.name}
                  >
                    <span className="text-base leading-none">{t.emoji}</span>
                    <span className="leading-tight truncate w-full text-center">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
