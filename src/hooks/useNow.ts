"use client";

import { useEffect, useState } from "react";

/**
 * 1秒ごとに進む「今の時刻」（epoch ms）。
 * 最初はサーバーで描いた時刻（initialNow）を使うので、サーバーとブラウザで表示がずれない
 */
export function useNow(initialNow: number) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return now;
}
