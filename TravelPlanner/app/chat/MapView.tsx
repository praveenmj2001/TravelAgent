"use client";

import { useEffect, useRef } from "react";

export interface MapWaypoint {
  name: string;
  lat: number;
  lng: number;
  type: "start" | "end" | "stop";
}

interface MapViewProps {
  waypoints: MapWaypoint[];
}

const TYPE_COLORS: Record<string, string> = {
  start: "#22c55e",
  end:   "#ef4444",
  stop:  "#6366f1",
};

export default function MapView({ waypoints }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || waypoints.length === 0) return;

    // Lazy-load Leaflet (browser-only)
    import("leaflet").then((L) => {
      if (!containerRef.current) return;
      // Fix default marker icon path broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Destroy previous map instance
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current!);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const bounds: [number, number][] = [];

      waypoints.forEach((wp) => {
        const color = TYPE_COLORS[wp.type] ?? "#6366f1";

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:${color};border:2px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker([wp.lat, wp.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${wp.name}</b><br/><span style="color:${color};font-size:11px">${wp.type}</span>`);

        bounds.push([wp.lat, wp.lng]);
      });

      // Draw route line
      if (bounds.length > 1) {
        L.polyline(bounds, { color: "#6366f1", weight: 3, opacity: 0.7, dashArray: "6,4" }).addTo(map);
      }

      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32] });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(waypoints)]);

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
    <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
      <div ref={containerRef} style={{ height: "260px", width: "100%" }} />
      <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        {(["start", "stop", "end"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TYPE_COLORS[t] }} />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </span>
        ))}
        <span className="ml-auto">© OpenStreetMap</span>
      </div>
    </div>
  );
}
