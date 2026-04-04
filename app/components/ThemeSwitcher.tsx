"use client";

import { useEffect, useState } from "react";

const SEASONS = [
  { key: "spring", icon: "🌸", label: "Spring" },
  { key: "summer", icon: "☀️", label: "Summer" },
  { key: "autumn", icon: "🍂", label: "Autumn" },
  { key: "winter", icon: "❄️", label: "Winter" },
] as const;

function getDefaultSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

export default function ThemeSwitcher() {
  const [active, setActive] = useState<string>("spring");

  useEffect(() => {
    const saved = localStorage.getItem("season") ?? getDefaultSeason();
    setActive(saved);
  }, []);

  function switchSeason(key: string) {
    const html = document.documentElement;
    SEASONS.forEach((s) => html.classList.remove(`theme-${s.key}`));
    html.classList.add(`theme-${key}`);
    localStorage.setItem("season", key);
    setActive(key);
  }

  return (
    <div className="flex items-center gap-1">
      {SEASONS.map((s) => (
        <button
          key={s.key}
          onClick={() => switchSeason(s.key)}
          title={s.label}
          className={`w-7 h-7 rounded-lg text-base flex items-center justify-center transition-all ${
            active === s.key
              ? "bg-[var(--t-primary-light)] ring-2 ring-[var(--t-primary)] scale-110"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 opacity-60 hover:opacity-100"
          }`}
        >
          {s.icon}
        </button>
      ))}
    </div>
  );
}
