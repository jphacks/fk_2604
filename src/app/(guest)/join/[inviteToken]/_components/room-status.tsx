"use client";

import { Clock } from "lucide-react";
import { formatCountdown, formatMembers } from "@/components/common/format";
import { useNow } from "@/hooks/useNow";

type RoomStatusProps = {
  expiresAt: number; // epoch ms
  /** サーバーで描いた時刻（epoch ms）。表示のずれを防ぐ */
  initialNow: number;
  memberCount?: number;
  maxMembers?: number | null;
};

/** 入室前に見せる、ルームの残り時間（1秒ごとに減る）と参加人数 */
export function RoomStatus({ expiresAt, initialNow, memberCount, maxMembers }: RoomStatusProps) {
  const now = useNow(initialNow);

  return (
    <div className="flex items-center gap-4 rounded-xl bg-cloud-pale px-5 py-5">
      <Clock className="size-5 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-xs text-ink-muted">ルームの残り時間</p>
        <p className="text-xl font-bold tabular-nums">{formatCountdown(expiresAt - now)}</p>
      </div>
      {memberCount !== undefined && (
        <p className="text-sm tabular-nums">
          <span className="sr-only">参加人数 </span>
          {formatMembers(memberCount, maxMembers)}
        </p>
      )}
    </div>
  );
}
