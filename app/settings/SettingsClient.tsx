"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SavedTrip {
  id: string;
  title: string;
  content: string;
  conversation_id: string | null;
  created_at: string;
}

interface LikedPlace {
  id: string;
  name: string;
  query: string;
  category: string | null;
  rating: string | null;
  created_at: string;
}

interface UserProfile {
  travel_persona?: string;
  travel_style?: string;
  trip_length?: string;
  interests?: string;
  home_city?: string;
  onboarded?: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

const PERSONA_LABELS: Record<string, string> = {
  solo: "🧳 Solo",
  couple: "💑 Couple",
  family: "👨‍👩‍👧‍👦 Family",
  friends: "🎉 Friends",
  work: "💼 Work trip",
};
const STYLE_LABELS: Record<string, string> = {
  adventure: "🏔️ Adventure",
  relaxed: "🏖️ Relaxed",
  cultural: "🏛️ Cultural",
  foodie: "🍜 Foodie",
  luxury: "✨ Luxury",
  budget: "💰 Budget",
};
const LENGTH_LABELS: Record<string, string> = {
  weekend: "🌅 Weekend (2-3 days)",
  week: "🗓️ A week",
  twoweeks: "📅 Two weeks",
  month: "🌍 A month or more",
};
const INTEREST_LABELS: Record<string, string> = {
  nature: "🌿 Nature",
  history: "🏰 History",
  food: "🍕 Food & Drink",
  nightlife: "🎵 Nightlife",
  sports: "⚽ Sports",
  art: "🎨 Art & Culture",
  beaches: "🏄 Beaches",
  mountains: "⛰️ Mountains",
};

export default function SettingsClient({
  userEmail,
  userName,
  userImage,
}: {
  userEmail: string;
  userName: string;
  userImage: string;
}) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingPersona, setEditingPersona] = useState(false);
  const [draftPersona, setDraftPersona] = useState<UserProfile>({});
  const [savingPersona, setSavingPersona] = useState(false);
  const [likedPlaces, setLikedPlaces] = useState<LikedPlace[]>([]);
  const [unlikingId, setUnlikingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND}/saved-trips?user_email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => setTrips(Array.isArray(data) ? data : []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [userEmail]);

  useEffect(() => {
    fetch(`${BACKEND}/profile?user_email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => {});
  }, [userEmail]);

  useEffect(() => {
    fetch(`${BACKEND}/liked-places?user_email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => setLikedPlaces(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [userEmail]);

  async function handleUnlike(id: string) {
    setUnlikingId(id);
    try {
      await fetch(`${BACKEND}/liked-places/${id}`, { method: "DELETE" });
      setLikedPlaces((prev) => prev.filter((p) => p.id !== id));
    } catch {}
    setUnlikingId(null);
  }

  function startEditPersona() {
    setDraftPersona({
      travel_persona: profile?.travel_persona ?? "",
      travel_style: profile?.travel_style ?? "",
      trip_length: profile?.trip_length ?? "",
      interests: profile?.interests ?? "",
      home_city: profile?.home_city ?? "",
    });
    setEditingPersona(true);
  }

  async function savePersona() {
    setSavingPersona(true);
    try {
      const res = await fetch(`${BACKEND}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail, ...draftPersona, onboarded: "true" }),
      });
      const updated = await res.json();
      setProfile(updated);
      setEditingPersona(false);
    } catch {}
    setSavingPersona(false);
  }

  function toggleInterest(val: string) {
    const current = draftPersona.interests ? draftPersona.interests.split(",").filter(Boolean) : [];
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    setDraftPersona((d) => ({ ...d, interests: next.join(",") }));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`${BACKEND}/saved-trips/${id}`, { method: "DELETE" });
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch {}
    setDeletingId(null);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-5 mb-8">
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={userImage}
            alt={userName}
            className="w-16 h-16 rounded-full border-2 border-[var(--t-primary-light)]"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--t-primary-light)] flex items-center justify-center text-2xl font-bold text-[var(--t-primary)]">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{userName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{userEmail}</p>
          <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs bg-[var(--t-primary-light)] text-[var(--t-primary)] px-2.5 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Google account
          </span>
        </div>
      </div>

      {/* Travel Persona */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Travel Persona</h2>
          {!editingPersona && (
            <button
              onClick={startEditPersona}
              className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
              style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}
            >
              Edit
            </button>
          )}
        </div>

        {!editingPersona ? (
          <div className="flex flex-wrap gap-2">
            {profile?.travel_persona && (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                {PERSONA_LABELS[profile.travel_persona] ?? profile.travel_persona}
              </span>
            )}
            {profile?.travel_style && (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                {STYLE_LABELS[profile.travel_style] ?? profile.travel_style}
              </span>
            )}
            {profile?.trip_length && (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                {LENGTH_LABELS[profile.trip_length] ?? profile.trip_length}
              </span>
            )}
            {profile?.interests && profile.interests.split(",").filter(Boolean).map((i) => (
              <span key={i} className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                {INTEREST_LABELS[i] ?? i}
              </span>
            ))}
            {profile?.home_city && (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                🏠 {profile.home_city}
              </span>
            )}
            {!profile?.travel_persona && !profile?.travel_style && !profile?.interests && !profile?.home_city && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No persona set yet.{" "}
                <Link href="/onboarding" className="text-[var(--t-primary)] hover:underline font-medium">
                  Set it up →
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Travelling as */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Travelling as</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PERSONA_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDraftPersona((d) => ({ ...d, travel_persona: val }))}
                    className="text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all"
                    style={{
                      borderColor: draftPersona.travel_persona === val ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                      background: draftPersona.travel_persona === val ? "var(--t-primary-light)" : "transparent",
                      color: draftPersona.travel_persona === val ? "var(--t-primary)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Style */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Travel style</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STYLE_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDraftPersona((d) => ({ ...d, travel_style: val }))}
                    className="text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all"
                    style={{
                      borderColor: draftPersona.travel_style === val ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                      background: draftPersona.travel_style === val ? "var(--t-primary-light)" : "transparent",
                      color: draftPersona.travel_style === val ? "var(--t-primary)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Trip length */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Typical trip length</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LENGTH_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDraftPersona((d) => ({ ...d, trip_length: val }))}
                    className="text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all"
                    style={{
                      borderColor: draftPersona.trip_length === val ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                      background: draftPersona.trip_length === val ? "var(--t-primary-light)" : "transparent",
                      color: draftPersona.trip_length === val ? "var(--t-primary)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Interests */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Interests</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(INTEREST_LABELS).map(([val, label]) => {
                  const selected = (draftPersona.interests ?? "").split(",").includes(val);
                  return (
                    <button
                      key={val}
                      onClick={() => toggleInterest(val)}
                      className="text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all"
                      style={{
                        borderColor: selected ? "var(--t-primary)" : "var(--accent, #e5e7eb)",
                        background: selected ? "var(--t-primary-light)" : "transparent",
                        color: selected ? "var(--t-primary)" : undefined,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Home city */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Home city</p>
              <input
                type="text"
                value={draftPersona.home_city ?? ""}
                onChange={(e) => setDraftPersona((d) => ({ ...d, home_city: e.target.value }))}
                placeholder="e.g. San Francisco, CA"
                className="w-full max-w-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white dark:bg-gray-900 outline-none focus:ring-2"
                style={{ "--tw-ring-color": "var(--t-primary)" } as React.CSSProperties}
              />
            </div>
            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={savePersona}
                disabled={savingPersona}
                className="text-sm px-4 py-2 rounded-full font-bold text-white transition-opacity disabled:opacity-50"
                style={{ background: "var(--t-primary)" }}
              >
                {savingPersona ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingPersona(false)}
                className="text-sm px-4 py-2 rounded-full font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liked Places */}
      {likedPlaces.length > 0 && (() => {
        // Group by category, fallback to "Other"
        const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
          restaurant: { label: "Restaurants & Food", emoji: "🍽️" },
          food:       { label: "Restaurants & Food", emoji: "🍽️" },
          cafe:       { label: "Cafés", emoji: "☕" },
          activity:   { label: "Activities", emoji: "🎯" },
          attraction: { label: "Attractions", emoji: "🏛️" },
          hotel:      { label: "Hotels & Stays", emoji: "🏨" },
          stay:       { label: "Hotels & Stays", emoji: "🏨" },
          stop:       { label: "Road Trip Stops", emoji: "📍" },
          park:       { label: "Parks & Nature", emoji: "🌿" },
          bar:        { label: "Bars & Nightlife", emoji: "🍸" },
          shop:       { label: "Shopping", emoji: "🛍️" },
        };

        const grouped = likedPlaces.reduce<Record<string, LikedPlace[]>>((acc, p) => {
          const key = p.category?.toLowerCase() ?? "other";
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        }, {});

        return (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Liked Places</h2>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{likedPlaces.length} saved</span>
            </div>

            <div className="flex flex-col gap-6">
              {Object.entries(grouped).map(([cat, places]) => {
                const meta = CATEGORY_LABELS[cat] ?? { label: cat.charAt(0).toUpperCase() + cat.slice(1), emoji: "📌" };
                return (
                  <div key={cat}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                      {meta.emoji} {meta.label}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {places.map((place) => (
                        <div
                          key={place.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            <div className="min-w-0">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-[var(--t-primary)] transition-colors truncate block"
                              >
                                {place.name}
                              </a>
                              {place.rating && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">⭐ {place.rating}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnlike(place.id)}
                            disabled={unlikingId === place.id}
                            title="Remove from liked"
                            className="shrink-0 p-1.5 rounded-full text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Saved trips */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Saved Trips</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">{trips.length} saved</span>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <span className="flex gap-1">
              {[0, 150, 300].map((d) => (
                <span key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          </div>
        )}

        {!loading && trips.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No saved trips yet.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Hover over any AI response in chat and click the bookmark icon to save it.</p>
            <Link
              href="/chat"
              className="inline-block mt-4 text-sm font-medium text-[var(--t-primary)] hover:underline"
            >
              Start planning →
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">🛣️</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{trip.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(trip.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {trip.conversation_id && (
                    <Link
                      href={`/chat?id=${trip.conversation_id}`}
                      className="text-xs px-2.5 py-1 rounded-full bg-[var(--t-primary-light)] text-[var(--t-primary)] hover:opacity-80 font-medium transition-opacity"
                    >
                      Open chat
                    </Link>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
                  >
                    {expandedId === trip.id ? "Hide" : "View"}
                  </button>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    disabled={deletingId === trip.id}
                    className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {expandedId === trip.id && (
                <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{trip.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
