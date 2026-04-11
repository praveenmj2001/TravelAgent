"use client";

import { useEffect, useState } from "react";

export default function BackendGreeting({ idToken }: { idToken?: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [userData, setUserData] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    if (!idToken) {
      setStatus("error");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: idToken }),
    })
      .then((r) => r.json())
      .then((data) => {
        setUserData(data);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [idToken]);

  if (status === "loading") {
    return <p className="text-xs text-gray-400">Verifying with backend...</p>;
  }
  if (status === "error") {
    return <p className="text-xs text-red-400">Backend verification failed (is the server running?)</p>;
  }
  return (
    <p className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
      Backend verified ✓
    </p>
  );
}
