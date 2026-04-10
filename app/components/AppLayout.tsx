"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { DevicePreviewProvider, DeviceFrame } from "./DevicePreview";

export default function AppLayout({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <DevicePreviewProvider>
      <DeviceFrame>
        <div
          className="flex h-screen overflow-hidden dark:from-gray-900 dark:to-gray-800"
          style={{ background: "linear-gradient(135deg, var(--t-app-from) 0%, var(--t-app-mid) 50%, var(--t-app-to) 100%)" }}
        >
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar — drawer on mobile, fixed on desktop */}
          <div
            className={`
              fixed lg:static inset-y-0 left-0 z-40
              transform transition-transform duration-300 ease-in-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
          >
            <Sidebar userEmail={userEmail} onClose={() => setSidebarOpen(false)} />
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <TopBar userEmail={userEmail} onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </DeviceFrame>
    </DevicePreviewProvider>
  );
}
