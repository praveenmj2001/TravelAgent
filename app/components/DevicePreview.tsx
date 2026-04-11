"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type DeviceMode = "desktop" | "iphone" | "ipad";

const DeviceContext = createContext<{
  mode: DeviceMode;
  setMode: (m: DeviceMode) => void;
}>({ mode: "desktop", setMode: () => {} });

export function useDeviceMode() {
  return useContext(DeviceContext);
}

export function DevicePreviewProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DeviceMode>("desktop");
  return (
    <DeviceContext.Provider value={{ mode, setMode }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function DeviceFrame({ children }: { children: ReactNode }) {
  const { mode } = useDeviceMode();
  if (mode === "desktop") return <>{children}</>;

  const frameClass = mode === "iphone" ? "device-frame-iphone" : "device-frame-ipad";
  const scale = mode === "iphone"
    ? Math.min(1, (window?.innerHeight - 80) / 844)
    : Math.min(1, (window?.innerHeight - 80) / 1024);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm overflow-auto py-8">
      <div
        className={`${frameClass} flex flex-col`}
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        {/* Notch bar for iPhone */}
        {mode === "iphone" && (
          <div className="shrink-0 h-8 bg-black w-full flex items-end justify-center pb-1 relative">
            <div className="w-24 h-5 bg-black rounded-b-2xl absolute top-0 left-1/2 -translate-x-1/2" />
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
        {/* Home indicator for iPhone */}
        {mode === "iphone" && (
          <div className="shrink-0 h-6 bg-black flex items-center justify-center">
            <div className="w-24 h-1 bg-gray-600 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

export function DevicePreviewToggle() {
  const { mode, setMode } = useDeviceMode();

  return (
    <div className="hidden lg:flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-full p-0.5 bg-gray-50 dark:bg-gray-800">
      {/* Desktop */}
      <button
        onClick={() => setMode("desktop")}
        title="Desktop view"
        className={`p-1.5 rounded-full transition-all ${mode === "desktop" ? "bg-white dark:bg-gray-700 shadow-sm" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${mode === "desktop" ? "text-[var(--t-primary)]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
      {/* iPad */}
      <button
        onClick={() => setMode("ipad")}
        title="iPad view"
        className={`p-1.5 rounded-full transition-all ${mode === "ipad" ? "bg-white dark:bg-gray-700 shadow-sm" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${mode === "ipad" ? "text-[var(--t-primary)]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </button>
      {/* iPhone */}
      <button
        onClick={() => setMode("iphone")}
        title="iPhone view"
        className={`p-1.5 rounded-full transition-all ${mode === "iphone" ? "bg-white dark:bg-gray-700 shadow-sm" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 ${mode === "iphone" ? "text-[var(--t-primary)]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}
