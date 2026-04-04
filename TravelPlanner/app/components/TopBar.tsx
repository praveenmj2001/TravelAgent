"use client";

import { signOut } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";

export default function TopBar({ userEmail }: { userEmail: string }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-3 border-b border-black/10 dark:bg-gray-900 dark:border-gray-700"
      style={{ backgroundColor: "var(--t-topbar-bg)" }}
    >
      <span className="text-sm font-bold text-[var(--t-primary)]">🚗 RoadAI</span>

      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{userEmail}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}
