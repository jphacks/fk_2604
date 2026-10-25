"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import { formatDayLabel, isSameDay } from "@/components/common/format";
import { CloudIcon } from "@/components/brand/cloud-icon";
import { MessageItem } from "./message-item";

type MessageListProps = {
  messages: Message[];
  myId: string;
  /** 「今日」「昨日」の判定に使う現在時刻 */
  now: number;
};

/** メッセージ一覧。日付が変わるところに区切りを入れ、新着が来たら一番下までスクロールする */
export function MessageList({ messages, myId, now }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
      <div className="mx-auto max-w-4xl">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 pt-14 text-center text-sm text-ink-muted">
            <CloudIcon className="h-10 w-14" />
            まだメッセージはありません。最初の一言をどうぞ。
          </div>
        )}

        {messages.map((m, i) => {
          const newDay = i === 0 || !isSameDay(messages[i - 1].sentAt, m.sentAt);
          return (
            <div key={m.id}>
              {newDay && (
                <p className="py-3 text-center text-[11px] text-ink-muted">
                  {formatDayLabel(m.sentAt, now)}
                </p>
              )}
              <MessageItem message={m} isMine={m.senderId === myId} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
