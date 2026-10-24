"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, MessagesResponse, RoomInfo } from "@/lib/types";

type Identity = { guestId: string; nickname: string };
type Status = "loading" | "ok" | "gone" | "full" | "error";

const POLL_MS = 2500;

/**
 * 2.5秒ごとに新着を取りに行く（ポーリング）。
 * 後でPusher等に替えるときは、この中身だけ差し替えればUIは変更不要。
 */
export function useMessages(roomId: string, me: Identity | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const cursor = useRef(0);

  const fetchNew = useCallback(async () => {
    if (!me) return;
    const qs = new URLSearchParams({
      guestId: me.guestId,
      nickname: me.nickname,
      cursor: String(cursor.current),
    });
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages?${qs}`, {
        cache: "no-store",
      });
      if (res.status === 404) return setStatus("gone");
      if (res.status === 403) return setStatus("full");
      if (!res.ok) return setStatus("error");
      const data: MessagesResponse = await res.json();
      cursor.current = data.nextCursor;
      setRoom(data.room);
      setMemberCount(data.memberCount);
      setStatus("ok");
      if (data.messages.length > 0) {
        setMessages((prev) => [...prev, ...data.messages]);
      }
    } catch {
      setStatus("error");
    }
  }, [roomId, me]);

  useEffect(() => {
    if (!me) return;
    const initialFetch = window.setTimeout(() => void fetchNew(), 0);
    const t = setInterval(fetchNew, POLL_MS);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(t);
    };
  }, [fetchNew, me]);

  const send = useCallback(
    async (body: string) => {
      if (!me) return false;
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...me, body }),
      });
      if (!res.ok) return false;
      await fetchNew(); // 送信後すぐ反映
      return true;
    },
    [roomId, me, fetchNew],
  );

  return { messages, room, memberCount, status, send };
}
