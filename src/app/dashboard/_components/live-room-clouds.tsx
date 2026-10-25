"use client";

import {
  RoomCloudList,
  type RoomCloudItem,
} from "@/components/dashboard/room-cloud-list";
import { useRoomHeat } from "@/hooks/useRoomHeat";
import {
  cloudSizeFromScore,
  cloudTintFromScore,
  currentScore,
  type RoomHeatsResponse,
} from "@/lib/room-heat";

type Props = {
  /** 雲に描くルーム（大きさと色はここで盛り上がりから決める） */
  rooms: Omit<RoomCloudItem, "size" | "tint">[];
  /** サーバーで取った最初の点数 */
  initialHeats: RoomHeatsResponse;
};

/**
 * 盛り上がりの点数を取り直しながら、雲の大きさと色を決めて一覧に渡す。
 * ここは機能だけ。見た目は components/dashboard/ が描く
 */
export function LiveRoomClouds({ rooms, initialHeats }: Props) {
  const { heats, now } = useRoomHeat(initialHeats);

  const items: RoomCloudItem[] = rooms.map((room) => {
    const score = currentScore(heats[room.id], now);
    return {
      ...room,
      size: cloudSizeFromScore(score),
      tint: cloudTintFromScore(score),
    };
  });

  return <RoomCloudList rooms={items} />;
}
