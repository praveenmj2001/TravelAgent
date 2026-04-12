"use client";

import { useEffect, useState } from "react";

interface Props {
  name: string;
  query: string;
  onClose: () => void;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function PlaceModal({ name, query, onClose }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [info, setInfo] = useState<{ rating: number | null; address: string | null }>({ rating: null, address: null });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"photos" | "map">("photos");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setActive((p) => (p + 1) % Math.max(photos.length, 1));
      if (e.key === "ArrowLeft")  setActive((p) => (p - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND}/places/photos?query=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        setPhotos(d.photos || []);
        setInfo({ rating: d.rating, address: d.address });
        setActive(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed&z=15`;
  const prev = () => setActive((p) => (p - 1 + photos.length) % photos.length);
  const next = () => setActive((p) => (p + 1) % photos.length);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "fadeIn 0.18s ease" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative flex flex-col rounded-3xl shadow-2xl overflow-hidden bg-gray-950"
        style={{
          width: "min(700px, 96vw)",
          height: "min(580px, 92vh)",
          animation: "modalPop 0.24s cubic-bezier(0.34,1.46,0.64,1)",
        }}
      >
        {/* Photo area */}
        <div className="relative flex-1 bg-black overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
              <svg className="w-8 h-8 animate-spin text-gray-600" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="text-sm">Loading photos…</span>
            </div>
          ) : photos.length > 0 ? (
            <>
              {/* Main image — contain keeps aspect ratio, no stretch */}
              <img
                key={active}
                src={photos[active]}
                alt={name}
                className="w-full h-full"
                style={{ objectFit: "contain", background: "#000", animation: "fadeIn 0.2s ease" }}
              />

              {/* Gradient overlays for readability */}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

              {/* Top bar — name + close */}
              <div className="absolute top-0 inset-x-0 flex items-start justify-between px-4 pt-4">
                <div>
                  <p className="text-white font-bold text-lg leading-tight drop-shadow">{name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {info.rating && (
                      <span className="text-xs bg-black/40 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">
                        ⭐ {info.rating}
                      </span>
                    )}
                    {info.address && (
                      <span className="text-xs bg-black/40 text-white/80 px-2 py-0.5 rounded-full truncate max-w-[280px]">
                        {info.address}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Prev / Next arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white text-xl flex items-center justify-center hover:bg-black/75 transition-all hover:scale-110"
                  >‹</button>
                  <button
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white text-xl flex items-center justify-center hover:bg-black/75 transition-all hover:scale-110"
                  >›</button>
                </>
              )}

              {/* Bottom bar — counter + thumbnails + actions */}
              <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
                {/* Dot counter */}
                {photos.length > 1 && (
                  <div className="flex justify-center gap-1.5 mb-2">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActive(i)}
                        className={`rounded-full transition-all ${i === active ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"}`}
                      />
                    ))}
                  </div>
                )}

                {/* Thumbnails strip */}
                {photos.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-none">
                    {photos.map((p, i) => (
                      <button key={i} onClick={() => setActive(i)} className="shrink-0">
                        <img
                          src={p}
                          alt=""
                          className={`w-12 h-9 object-cover rounded-lg transition-all ${
                            i === active
                              ? "ring-2 ring-white scale-105"
                              : "opacity-50 hover:opacity-90"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">{active + 1} / {photos.length}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTab(tab === "map" ? "photos" : "map")}
                      className="text-xs px-3 py-1.5 rounded-full bg-white/15 text-white font-medium hover:bg-white/25 transition-colors"
                    >
                      {tab === "map" ? "📷 Photos" : "🗺 Map"}
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-full bg-[var(--t-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                    >
                      Open in Maps ↗
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* No photos — show map only */
            <div className="relative w-full h-full flex flex-col">
              <div className="absolute top-4 left-4 right-12 z-10">
                <p className="text-white font-bold text-lg drop-shadow">{name}</p>
                {info.address && <p className="text-white/70 text-xs mt-0.5">{info.address}</p>}
              </div>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <iframe src={mapSrc} className="w-full flex-1 border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={name} />
            </div>
          )}

          {/* Map tab overlay */}
          {tab === "map" && photos.length > 0 && (
            <div className="absolute inset-0 z-20" style={{ animation: "fadeIn 0.2s ease" }}>
              <iframe src={mapSrc} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={name} />
              <button
                onClick={() => setTab("photos")}
                className="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-full bg-black/60 text-white font-medium hover:bg-black/80 transition-colors"
              >
                ✕ Close map
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
