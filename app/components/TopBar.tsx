"use client";

import { signOut } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";
import { DevicePreviewToggle } from "./DevicePreview";
import TravelAILogo from "./TravelAILogo";

export default function TopBar({
  userEmail,
  onMenuClick,
}: {
  userEmail: string;
  onMenuClick?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10 dark:bg-gray-900 dark:border-gray-700 shrink-0"
      style={{ backgroundColor: "var(--t-topbar-bg)" }}
    >
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          title="Menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--t-primary)]">
          <TravelAILogo size={20} />
          TravelAI
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Device preview toggle — desktop only */}
        <DevicePreviewToggle />

        <ThemeSwitcher variant="light" />
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:block truncate max-w-[140px]">{userEmail}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium"
          title="Sign out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </div>
  );
}
