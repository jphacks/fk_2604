"use client";

import { useEffect, useState } from "react";

/** expiresAt（epoch ms）までの残り時間を1秒ごとに返す。0以下で期限切れ */
export function useCountdown(expiresAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!expiresAt) return { remainingMs: null, label: "--:--:--" };
  const remainingMs = Math.max(0, expiresAt - now);
  const s = Math.floor(remainingMs / 1000);
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return { remainingMs, label: `${d > 0 ? `${d}日 ` : ""}${h}:${m}:${sec}` };
}
