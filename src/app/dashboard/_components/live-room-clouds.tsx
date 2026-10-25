"use client";

import { formatCountdown, formatMembers } from "@/components/common/format";
import {
  RoomCloudList,
  type RoomCloudItem,
} from "@/components/dashboard/room-cloud-list";
import { useNow } from "@/hooks/useNow";
import { useRoomHeat } from "@/hooks/useRoomHeat";
import {
  cloudSizeFromScore,
  currentScore,
  type RoomHeatsResponse,
} from "@/lib/room-heat";

export type DashboardRoom = {
  id: string;
  name: string;
  href: string;
  settingsHref: string;
  startsAt: number; // epoch ms
  expiresAt: number; // epoch ms
  memberCount: number;
  maxMembers: number | null;
};

type Props = {
  /** 雲に描くルーム（大きさ・残り時間・濃さはここで決める） */
  rooms: DashboardRoom[];
  /** サーバーで取った最初の点数 */
  initialHeats: RoomHeatsResponse;
};

/**
 * 盛り上がりの点数を取り直しながら雲の大きさを決め、1秒ごとに残り時間と濃さを進めて一覧に渡す。
 * ここは機能だけ。見た目は components/dashboard/ が描く
 */
export function LiveRoomClouds({ rooms, initialHeats }: Props) {
  const { heats, now: heatNow } = useRoomHeat(initialHeats);
  const now = useNow(initialHeats.now);

  const items: RoomCloudItem[] = rooms.map((room) => {
    const period = room.expiresAt - room.startsAt;
    // 開始前のルームは満タン（100%）として扱う
    const remaining = Math.min(period, room.expiresAt - now);
    return {
      id: room.id,
      name: room.name,
      href: room.href,
      settingsHref: room.settingsHref,
      countdown: formatCountdown(room.expiresAt - now),
      membersLabel: formatMembers(room.memberCount, room.maxMembers),
      remainingRatio: period > 0 ? Math.min(1, Math.max(0, remaining / period)) : 0,
      size: cloudSizeFromScore(currentScore(heats[room.id], heatNow)),
    };
  });

  return <RoomCloudList rooms={items} />;
}
