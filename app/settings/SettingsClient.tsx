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

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

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

  useEffect(() => {
    fetch(`${BACKEND}/saved-trips?user_email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => setTrips(Array.isArray(data) ? data : []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [userEmail]);

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
