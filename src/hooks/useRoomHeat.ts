"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomHeatsResponse } from "@/lib/room-heat";

const POLL_MS = 30_000;

/**
 * 30秒ごとに自分のルームの盛り上がりを取り直す（ポーリング）。
 * 最初の値はサーバーで計算したもの（initial）を使うので、開いた瞬間から雲の大きさが出る。
 *
 * 時刻について
 * - 点数は時間で減るので、計算には「今の時刻」が要る
 * - ブラウザの時計はずれていることがあるため、サーバーの時刻（now）との差を覚えておき、
 *   ブラウザの時刻に足して「サーバー基準の今」として使う
 */
export function useRoomHeat(initial: RoomHeatsResponse) {
  const [heats, setHeats] = useState(initial.heats);
  const [now, setNow] = useState(initial.now);
  const offset = useRef(0); // サーバーの時刻 − ブラウザの時刻（ミリ秒）

  const fetchHeats = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms/heat", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: RoomHeatsResponse = await res.json();
      offset.current = data.now - Date.now();
      setHeats(data.heats);
      setNow(data.now);
    } catch {
      // 失敗しても点数は時間で減るので、前の heats のまま時刻だけ進める
      setNow(Date.now() + offset.current);
    }
  }, []);

  useEffect(() => {
    offset.current = initial.now - Date.now(); // 最初の差はサーバーで描いた時刻から求める
    const t = setInterval(fetchHeats, POLL_MS);
    return () => clearInterval(t);
  }, [fetchHeats, initial.now]);

  return { heats, now };
}
