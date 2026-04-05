"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import ThemeSwitcher from "@/app/components/ThemeSwitcher";

const SEASON_CONTENT: Record<string, { emoji: string; headline: string; sub: string; trips: string[] }> = {
  spring: {
    emoji: "🌸",
    headline: "Discover scenic routes in bloom",
    sub: "Spring is the best time to hit the road — wildflowers, waterfalls, and open highways.",
    trips: ["PCH through Big Sur", "Blue Ridge Parkway", "Columbia River Gorge"],
  },
  summer: {
    emoji: "☀️",
    headline: "Chase the horizon this summer",
    sub: "Golden hour on endless highways. Let AI plan your ultimate summer road trip.",
    trips: ["Route 66 Classic", "Yellowstone Loop", "Great Lakes Circle Tour"],
  },
  autumn: {
    emoji: "🍂",
    headline: "Chase the fall colors by road",
    sub: "Fiery reds and golden yellows await. The most beautiful drives of the year.",
    trips: ["Vermont Foliage Trail", "Smoky Mountains Drive", "Oregon Coast Highway"],
  },
  winter: {
    emoji: "❄️",
    headline: "Plan your winter road adventure",
    sub: "Snowy mountain passes, hot springs, and cozy lodges along the way.",
    trips: ["Rocky Mountain Circuit", "Alaska Highway", "Glacier National Park"],
  },
};

function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

export default function SignInPage() {
  const season = typeof window !== "undefined"
    ? (localStorage.getItem("season") ?? getCurrentSeason())
    : getCurrentSeason();

  const content = SEASON_CONTENT[season] ?? SEASON_CONTENT.spring;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] px-4 py-12">

      {/* Season switcher top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitcher variant="light" />
      </div>

      {/* Card */}
      <div className="flex w-full max-w-[928px] min-h-[640px] bg-white rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.125)] overflow-hidden">

        {/* Left — Form */}
        <div className="flex flex-col justify-between w-full md:w-[440px] shrink-0 p-10">

          {/* Top */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-8">
              <span className="text-2xl">🚗</span>
              <span className="text-xl font-bold" style={{ color: "var(--t-primary-text)", fontFamily: "'DM Sans', sans-serif" }}>
                RoadAI
              </span>
            </Link>

            <h1 className="text-[28px] font-bold leading-tight mb-2" style={{ color: "#301345", fontFamily: "'DM Sans', sans-serif" }}>
              Welcome back
            </h1>
            <p className="text-sm mb-8" style={{ color: "#6b7280" }}>
              Sign in to plan your next road trip with AI.
            </p>

            {/* Google button — airial style */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/chat" })}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full border bg-white font-medium text-sm transition-all duration-200 hover:bg-[#f9f9f9] active:scale-[0.98]"
              style={{
                border: "1px solid rgba(24,8,0,0.13)",
                color: "#221f1e",
                minHeight: "48px",
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "-0.21px",
                boxShadow: "none",
              }}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Gradient CTA button */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/chat" })}
              className="w-full flex items-center justify-center py-3 px-4 rounded-full text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(270deg, var(--t-accent) 0%, var(--t-primary) 100%)",
                minHeight: "48px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Start Planning for Free →
            </button>
          </div>

          {/* Bottom */}
          <div className="mt-8">
            <p className="text-xs text-center" style={{ color: "#442a57", fontFamily: "'DM Sans', sans-serif" }}>
              By continuing you agree to our{" "}
              <span className="cursor-pointer hover:underline" style={{ color: "var(--t-primary)" }}>Terms of Service</span>
              {" "}and{" "}
              <span className="cursor-pointer hover:underline" style={{ color: "var(--t-primary)" }}>Privacy Policy</span>
            </p>
            <p className="text-xs text-center mt-3" style={{ color: "#442a57", fontFamily: "'DM Sans', sans-serif" }}>
              <Link href="/" className="hover:underline" style={{ color: "var(--t-primary)" }}>
                ← Back to home
              </Link>
            </p>
          </div>
        </div>

        {/* Right — Seasonal visual panel (hidden on mobile) */}
        <div
          className="hidden md:flex flex-1 flex-col justify-between p-10 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, var(--t-hero-from) 0%, var(--t-hero-mid) 50%, var(--t-hero-to) 100%)` }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 bg-white" />
          <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full opacity-10 bg-white" />

          {/* Top label */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 text-white/70 text-xs font-medium bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              AI-Powered Road Trip Planner
            </span>
          </div>

          {/* Center content */}
          <div className="relative z-10 my-auto">
            <div className="text-6xl mb-6">{content.emoji}</div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {content.headline}
            </h2>
            <p className="text-white/70 text-sm leading-relaxed mb-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {content.sub}
            </p>

            {/* Suggested trips */}
            <div className="flex flex-col gap-2">
              <p className="text-white/50 text-xs uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Trending this season
              </p>
              {content.trips.map((trip) => (
                <div
                  key={trip}
                  className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 backdrop-blur-sm"
                >
                  <span className="text-white/60 text-sm">🛣️</span>
                  <span className="text-white text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>{trip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom quote */}
          <div className="relative z-10">
            <p className="text-white/50 text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              "No printed maps. No chaos. Just the open road."
            </p>
          </div>
        </div>

      </div>

      {/* DM Sans font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet" />
    </div>
  );
}
