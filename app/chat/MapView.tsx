"use client";

import { useEffect, useRef, useState } from "react";

export interface MapWaypoint {
  name: string;
  lat: number;
  lng: number;
  type: "start" | "end" | "stop";
  time_hours?: number;
  distance_miles?: number;
}

const TYPE_COLORS: Record<string, string> = {
  start: "#22c55e",
  end:   "#ef4444",
  stop:  "#6366f1",
};

export default function MapView({ waypoints }: { waypoints: MapWaypoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Build map
  useEffect(() => {
    if (!containerRef.current || waypoints.length === 0) return;

    import("leaflet").then((L) => {
      if (!containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const map = L.map(containerRef.current!);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const bounds: [number, number][] = [];
      waypoints.forEach((wp, i) => {
        const color = TYPE_COLORS[wp.type] ?? "#6366f1";

        // Stop number label for stops (not start/end)
        const labelHtml = wp.type === "stop"
          ? `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;">${i}</div>`
          : `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`;

        const icon = L.divIcon({ className: "", html: labelHtml, iconSize: [22, 22], iconAnchor: [11, 11] });

        let popupContent = `<b style="font-size:12px">${wp.name}</b><br/><span style="color:${color};font-size:10px;text-transform:capitalize">${wp.type}</span>`;
        if (wp.time_hours != null && wp.distance_miles != null) {
          popupContent += `<br/><span style="font-size:11px;color:#555">🕐 ${wp.time_hours}h &nbsp;📍 ${wp.distance_miles} mi from prev stop</span>`;
        }

        L.marker([wp.lat, wp.lng], { icon }).addTo(map).bindPopup(popupContent);
        bounds.push([wp.lat, wp.lng]);
      });

      if (bounds.length > 1) {
        // Draw route segments with individual colours
        for (let i = 0; i < waypoints.length - 1; i++) {
          const a = waypoints[i];
          const b = waypoints[i + 1];
          L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
            color: "#6366f1", weight: 3, opacity: 0.7, dashArray: "6,4",
          }).addTo(map);

          // Segment label at midpoint
          if (b.time_hours != null && b.distance_miles != null) {
            const midLat = (a.lat + b.lat) / 2;
            const midLng = (a.lng + b.lng) / 2;
            const timeStr = b.time_hours >= 1
              ? `${b.time_hours}h`
              : `${Math.round(b.time_hours * 60)}min`;
            const labelHtml = `<div style="transform:translate(-50%,-50%);background:rgba(20,20,32,0.88);color:white;font-size:10px;font-weight:600;padding:4px 9px;border-radius:20px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.18);cursor:pointer;">🕐 ${timeStr} &nbsp;·&nbsp; ${b.distance_miles} mi</div>`;
            const segIcon = L.divIcon({ className: "", html: labelHtml, iconSize: [0, 0], iconAnchor: [0, 0] });
            L.marker([midLat, midLng], { icon: segIcon })
              .addTo(map)
              .bindPopup(`<b style="font-size:12px">Segment ${i + 1} → ${i + 2}</b><br/><span style="font-size:11px">📍 ${a.name} → ${b.name}</span><br/><span style="font-size:11px;color:#555">🕐 ${timeStr} driving &nbsp;|&nbsp; ${b.distance_miles} miles</span>`);
          }
        }
      }
      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32] });
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(waypoints)]);

  // Invalidate size + refit whenever fullscreen toggles
  useEffect(() => {
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize({ animate: false });
      // Re-fit bounds after resize
      import("leaflet").then((L) => {
        if (!mapRef.current || waypoints.length === 0) return;
        const bounds = waypoints.map((wp): [number, number] => [wp.lat, wp.lng]);
        mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], animate: false });
      });
    }, 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // Load Leaflet CSS once
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  if (waypoints.length === 0) return null;

  return (
    <>
      {/* Fullscreen backdrop (click to close) — NO blur, it bleeds into the map */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/70"
          onClick={() => setFullscreen(false)}
        />
      )}

      {/* The card — CSS-only fullscreen, map container never unmounts */}
      <div
        className={fullscreen
          ? "fixed inset-3 z-[9999] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          : "mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
        }
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white text-xs font-semibold">🗺️ {waypoints.length} stops</span>
            {(() => {
              const totalMiles = waypoints.reduce((s, w) => s + (w.distance_miles ?? 0), 0);
              const totalHours = waypoints.reduce((s, w) => s + (w.time_hours ?? 0), 0);
              if (totalMiles === 0) return null;
              const hh = Math.floor(totalHours);
              const mm = Math.round((totalHours - hh) * 60);
              const timeStr = hh > 0 ? `${hh}h ${mm > 0 ? mm + "m" : ""}`.trim() : `${mm}m`;
              return (
                <>
                  <span className="text-gray-400 text-[10px]">·</span>
                  <span className="text-amber-400 text-xs font-medium">🕐 {timeStr} drive</span>
                  <span className="text-gray-400 text-[10px]">·</span>
                  <span className="text-blue-400 text-xs font-medium">📍 {Math.round(totalMiles)} mi total</span>
                </>
              );
            })()}
          </div>
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
          >
            {fullscreen ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4H4v5h5zm6-5v5h5V4h-5zM9 20H4v-5h5v5zm6 0v-5h5v5h-5z" />
                </svg>
                Exit <span className="opacity-50">Esc</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
                Fullscreen
              </>
            )}
          </button>
        </div>

        {/* Map — always in DOM, just height changes */}
        <div
          ref={containerRef}
          className="flex-1"
          style={{ width: "100%", height: fullscreen ? "calc(100vh - 80px)" : "260px" }}
        />
      </div>
    </>
  );
}
