"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";

const CYCLING_WORDS = ["scenic", "epic", "spontaneous", "unforgettable", "yours"];

const FEATURES = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />
      </svg>
    ),
    title: "Smart Routes",
    desc: "RoadAI plans your entire road trip — scenic byways, hidden gems, drive times, and alternatives you'd never find on your own.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "Just Chat",
    desc: "No forms, no spreadsheets, no 47 open tabs. Just tell the AI your vibe — it handles the rest.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
    title: "Save & Revisit",
    desc: "Every conversation is saved with an auto-generated title. Pick up any trip where you left off, anytime.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: "Curated for Road Trips",
    desc: "Built specifically for driving adventures — rest stops, fuel, roadside diners, overlooks, and state parks included.",
  },
];

const STEPS = [
  { number: "01", title: "Sign in with Google", desc: "One click, no passwords. You're in." },
  { number: "02", title: "Tell RoadAI your dream trip", desc: "Destination, dates, vibe — or just wing it. RoadAI figures it out." },
  { number: "03", title: "Hit the road", desc: "Your personalized route is ready. Save it, tweak it, and go." },
];

export default function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % CYCLING_WORDS.length);
        setVisible(true);
      }, 350);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚗</span>
            <span className={`font-bold text-lg ${scrolled ? "text-gray-900" : "text-white"}`}>RoadAI</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <button
              onClick={() => signIn("google", { callbackUrl: "/welcome" })}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/80 hover:text-white"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => signIn("google", { callbackUrl: "/chat" })}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-white text-[var(--t-primary)] hover:opacity-90 transition-colors shadow-sm"
            >
              Start Planning →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20" style={{ background: "linear-gradient(to bottom right, var(--t-hero-from), var(--t-hero-mid), var(--t-hero-to))" }}>
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-4 py-1.5 rounded-full mb-8 border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          AI Powered
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight max-w-4xl">
          Your next road trip<br />should be{" "}
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 inline-block transition-all duration-300"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)" }}
          >
            {CYCLING_WORDS[wordIndex]}
          </span>
          <span className="animate-pulse text-purple-300">|</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
          No printed maps. No chaos. No regrets.<br />
          Just chat with AI and get a road trip built around you.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center">
          <button
            onClick={() => signIn("google", { callbackUrl: "/chat" })}
            className="px-8 py-4 bg-white font-semibold rounded-2xl text-base hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-[var(--t-primary)]"
          >
            Start Planning for Free
          </button>
          <a href="#how-it-works" className="text-white/60 text-sm hover:text-white/90 transition-colors">
            See how it works ↓
          </a>
        </div>

        {/* Mock chat bubble preview */}
        <div className="mt-16 bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 max-w-lg w-full text-left shadow-2xl">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-indigo-400 flex items-center justify-center text-xs shrink-0">🧑</div>
            <div className="bg-white/20 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm">
              Plan a 3-day road trip from San Francisco to LA with scenic stops
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs shrink-0">🤖</div>
            <div className="bg-[var(--t-bubble-user)]/70 text-white/90 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm">
              <span className="font-semibold">🚗 SF → LA via Highway 1</span><br />
              Day 1: SF → Santa Cruz → Big Sur (4.5 hrs driving)…
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900">Everything your road trip needs</h2>
            <p className="mt-4 text-gray-500 text-lg">Built for drivers who love the journey as much as the destination.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-[var(--t-ring)] hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[var(--t-primary-light)] text-[var(--t-primary)] flex items-center justify-center mb-4 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900">From idea to itinerary in minutes</h2>
            <p className="mt-4 text-gray-500 text-lg">No accounts to configure. No preferences to fill out.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center">
                <div className="text-5xl font-black text-[var(--t-primary-light)] mb-4">{s.number}</div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center" style={{ background: "linear-gradient(to bottom right, var(--t-hero-from), var(--t-hero-to))" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to hit the road?</h2>
          <p className="text-white/70 text-lg mb-10">
            Join road trippers who plan smarter, drive better, and discover more.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/chat" })}
            className="px-10 py-4 bg-white font-semibold rounded-2xl text-lg hover:opacity-90 transition-all shadow-xl hover:-translate-y-0.5 text-[var(--t-primary)]"
          >
            Start Your Road Trip →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 py-8 px-6 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">🚗</span>
          <span className="text-white font-semibold">RoadAI</span>
        </div>
        <p>Built with RoadAI · {new Date().getFullYear()}</p>
      </footer>

    </div>
  );
}
