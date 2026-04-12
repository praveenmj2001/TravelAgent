"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { DevicePreviewProvider, DeviceFrame } from "./DevicePreview";

export default function AppLayout({
  children,
  userEmail,
  userImage,
  userName,
}: {
  children: React.ReactNode;
  userEmail: string;
  userImage?: string;
  userName?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const sidebarWidth = sidebarCollapsed ? 56 : 256;

  return (
    <DevicePreviewProvider>
      <DeviceFrame>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            height: "100vh",
            width: "100%",
            overflow: "hidden",
            background: "linear-gradient(135deg, var(--t-app-from) 0%, var(--t-app-mid) 50%, var(--t-app-to) 100%)",
          }}
        >
          {/* Desktop sidebar — only in flex flow when desktop width */}
          {isDesktop && (
            <div style={{ width: sidebarWidth, flexShrink: 0, overflow: "hidden", transition: "width 300ms" }}>
              <Sidebar
                userEmail={userEmail}
                userImage={userImage}
                userName={userName}
                onClose={() => setSidebarOpen(false)}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
              />
            </div>
          )}

          {/* Mobile overlay backdrop */}
          {!isDesktop && sidebarOpen && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.5)" }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Mobile sidebar — fixed drawer */}
          {!isDesktop && (
            <div
              style={{
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: 40,
                transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 300ms ease-in-out",
              }}
            >
              <Sidebar userEmail={userEmail} userImage={userImage} userName={userName} onClose={() => setSidebarOpen(false)} />
            </div>
          )}

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <TopBar userEmail={userEmail} onMenuClick={() => setSidebarOpen(true)} />
            <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              {children}
            </main>
          </div>
        </div>
      </DeviceFrame>
    </DevicePreviewProvider>
  );
}
