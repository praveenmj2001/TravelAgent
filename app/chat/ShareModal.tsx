"use client";

import { useState } from "react";

interface ShareModalProps {
  shareUrl: string;
  onClose: () => void;
}

interface ShareOption {
  name: string;
  icon: string;
  href: string;
}

export default function ShareModal({ shareUrl, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const encoded = encodeURIComponent(shareUrl);
  const options: ShareOption[] = [
    { name: "WhatsApp", icon: "🟢", href: `https://wa.me/?text=${encoded}` },
    { name: "X", icon: "⚫", href: `https://twitter.com/intent/tweet?url=${encoded}` },
    { name: "Facebook", icon: "🔵", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
    { name: "Telegram", icon: "🔷", href: `https://t.me/share/url?url=${encoded}` },
    { name: "Gmail", icon: "🔴", href: `https://mail.google.com/mail/?body=${encoded}` },
    { name: "LinkedIn", icon: "🔹", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}` },
    { name: "SMS", icon: "💬", href: `sms:?body=${encoded}` },
    { name: "Instagram", icon: "🟣", href: "https://www.instagram.com/" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[85vh] flex flex-col overflow-hidden dark:bg-gray-900">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Share this trip</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close share modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-4 gap-3">
            {options.map((option) => (
              <a
                key={option.name}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">
                  {option.icon}
                </span>
                <span className="text-[11px] leading-tight text-center text-gray-600 dark:text-gray-300">{option.name}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{shareUrl}</div>
          <button
            onClick={handleCopy}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--t-primary)" }}
          >
            {copied ? "Link copied!" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
