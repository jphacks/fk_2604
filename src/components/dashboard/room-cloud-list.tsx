import Link from "next/link";
import { Plus } from "lucide-react";
import { CloudIcon } from "@/components/brand/cloud-icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomCloud } from "./room-cloud";

export type RoomCloudItem = {
  id: string;
  name: string;
  href: string;
  remainingLabel: string;
  endsToday: boolean;
};

// 雲の大きさと高さを順番に変えて、並びが単調にならないようにする
const SIZES = ["lg", "sm", "md"] as const;
const OFFSETS = ["md:translate-y-0", "md:translate-y-10", "md:-translate-y-4"];

/** ダッシュボードの空。ルームを雲として並べる */
export function RoomCloudList({ rooms }: { rooms: RoomCloudItem[] }) {
  return (
    <ul className="flex flex-wrap items-start justify-center gap-x-6 gap-y-10 md:gap-x-16 md:gap-y-16">
      {rooms.map((room, i) => (
        <div key={room.id} className={OFFSETS[i % OFFSETS.length]}>
          <RoomCloud
            href={room.href}
            name={room.name}
            remainingLabel={room.remainingLabel}
            endsToday={room.endsToday}
            size={SIZES[i % SIZES.length]}
            floatDelay={(i % 4) * 0.8}
          />
        </div>
      ))}
    </ul>
  );
}

/** ルームがまだないとき */
export function RoomCloudEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <CloudIcon className="h-16 w-24 opacity-60" />
      <p className="font-bold text-ink">空はまだ晴れています</p>
      <p className="text-sm text-ink-muted">ルームを作ると、ここに雲が浮かびます。</p>
      <Link href="/rooms/new" className={cn(buttonVariants({ size: "lg" }), "mt-2 px-4")}>
        <Plus aria-hidden />
        ルーム作成
      </Link>
    </div>
  );
}

/** 読み込みに失敗したとき */
export function RoomCloudError() {
  return (
    <p className="py-16 text-center text-sm text-ink-muted" role="alert">
      ルームを読み込めませんでした。時間をおいて再読み込みしてください。
    </p>
  );
}
