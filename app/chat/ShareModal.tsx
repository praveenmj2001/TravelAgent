"use client";

import { useState, type ReactNode } from "react";

interface ShareModalProps {
  shareUrl: string;
  onClose: () => void;
}

interface ShareOption {
  name: string;
  icon: ReactNode;
  href: string;
  note?: string;
}

export default function ShareModal({ shareUrl, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Unable to copy automatically. Please copy the link manually.");
    }
  }

  const encoded = encodeURIComponent(shareUrl);
  const options: ShareOption[] = [
    {
      name: "WhatsApp",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#25D366]" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.65 15l-1.2 4.3 4.42-1.16A10 10 0 1 0 12 2Zm0 18.17a8.13 8.13 0 0 1-4.14-1.13l-.3-.17-2.62.69.7-2.55-.2-.32A8.16 8.16 0 1 1 12 20.17Zm4.47-5.76c-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.54.12s-.62.79-.76.95c-.14.16-.28.18-.52.06a6.62 6.62 0 0 1-1.95-1.2 7.3 7.3 0 0 1-1.35-1.69c-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.79-.2-.47-.4-.4-.54-.4h-.46a.9.9 0 0 0-.66.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.59 4.1 3.63.57.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
        </svg>
      ),
      href: `https://wa.me/?text=${encoded}`,
    },
    {
      name: "X",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-900 dark:text-gray-100" fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-6.78 7.75L23 22h-6.4l-5-6.54L5.88 22H2.76l7.26-8.3L1 2h6.56l4.51 5.95L18.9 2Zm-1.12 18.08h1.77L6.6 3.82H4.7l13.08 16.26Z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?url=${encoded}`,
    },
    {
      name: "Facebook",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1877F2]" fill="currentColor" aria-hidden="true">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.12 11.93v-8.43H7.08v-3.5h3.04V9.4c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.5h-2.79V24C19.61 23.1 24 18.1 24 12.07Z" />
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    },
    {
      name: "Telegram",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#229ED9]" fill="currentColor" aria-hidden="true">
          <path d="M9.04 15.48 8.66 20.8c.54 0 .77-.23 1.04-.5l2.48-2.38 5.14 3.76c.94.52 1.6.25 1.84-.86l3.33-15.6v-.01c.3-1.4-.5-1.95-1.42-1.61L1.66 11.03c-1.33.52-1.3 1.27-.23 1.6l4.97 1.55L17.9 7.1c.54-.35 1.03-.16.62.2L9.04 15.48Z" />
        </svg>
      ),
      href: `https://t.me/share/url?url=${encoded}`,
    },
    {
      name: "Gmail",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#EA4335]" fill="currentColor" aria-hidden="true">
          <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-13Zm2.4.7v12.6h2.2V10l5.4 3.9L17.4 10v8.8h2.2V6.2L12 11.7 4.4 6.2Z" />
        </svg>
      ),
      href: `https://mail.google.com/mail/?body=${encoded}`,
    },
    {
      name: "LinkedIn",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0A66C2]" fill="currentColor" aria-hidden="true">
          <path d="M4.98 3.5A2.48 2.48 0 1 0 5 8.46a2.48 2.48 0 0 0-.02-4.96ZM2.75 9.7h4.5V21h-4.5V9.7Zm7.2 0h4.32v1.54h.06c.6-1.13 2.08-2.33 4.28-2.33 4.58 0 5.42 3.01 5.42 6.92V21h-4.5v-4.65c0-1.1-.02-2.52-1.53-2.52-1.53 0-1.77 1.2-1.77 2.44V21h-4.5V9.7Z" />
        </svg>
      ),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    },
    {
      name: "SMS",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#16A34A]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8.5 8.5 0 0 1-8.5 8.5H5l-2 2v-7.5A8.5 8.5 0 1 1 21 12Z" />
        </svg>
      ),
      href: `sms:?body=${encoded}`,
    },
    {
      name: "Instagram",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#C13584]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      ),
      href: "https://www.instagram.com/",
      note: "No direct link share",
    },
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
                aria-label={`Share via ${option.name}`}
                className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {option.icon}
                </span>
                <span className="text-[11px] leading-tight text-center text-gray-600 dark:text-gray-300">{option.name}</span>
                {option.note && (
                  <span className="text-[10px] leading-tight text-center text-gray-400 dark:text-gray-500">{option.note}</span>
                )}
              </a>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{shareUrl}</div>
          {copyError && (
            <p className="text-xs text-red-600 dark:text-red-400">{copyError}</p>
          )}
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
