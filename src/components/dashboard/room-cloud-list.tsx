import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { CloudIcon } from "@/components/brand/cloud-icon";
import { buttonVariants } from "@/components/ui/button";
import type { CloudSize } from "@/lib/room-heat";
import { cn } from "@/lib/utils";
import { RoomCloud } from "./room-cloud";

export type RoomCloudItem = {
  id: string;
  name: string;
  href: string;
  settingsHref: string;
  countdown: string;
  membersLabel: string;
  /** 初期の生存時間に対する残りの割合 0〜1（雲の濃さ） */
  remainingRatio: number;
  /** 雲の大きさ（会話の盛り上がりで決まる） */
  size: CloudSize;
};

/** ダッシュボードの空。ルームを雲として2列に並べ、2段目は少し右にずらして重ねる */
export function RoomCloudList({ rooms }: { rooms: RoomCloudItem[] }) {
  return (
    <div className="relative">
      {/* 太陽の飾り（右上の雲の後ろ） */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 right-[2%] hidden size-28 rounded-full bg-sun md:block lg:size-32"
      />
      <ul className="mx-auto grid max-w-md grid-cols-1 gap-y-8 md:max-w-none md:grid-cols-2 md:gap-x-10 md:gap-y-0 lg:gap-x-16">
        {rooms.map((room, i) => (
          <RoomCloud
            key={room.id}
            href={room.href}
            settingsHref={room.settingsHref}
            name={room.name}
            countdown={room.countdown}
            membersLabel={room.membersLabel}
            remainingRatio={room.remainingRatio}
            size={room.size}
            floatDelay={(i % 4) * 0.8}
            // 2段目・4段目…は右にずらし、上の段と少し重ねる
            className={cn(
              Math.floor(i / 2) % 2 === 1 && "md:translate-x-[8%]",
              i >= 2 && "md:-mt-6",
            )}
          />
        ))}
      </ul>
    </div>
  );
}

/** 雲の大きさの説明（会話が盛り上がっているルームほど大きい） */
export function RoomCloudLegend() {
  return (
    <div className="mt-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink">会話が盛り上がっているルームほど、雲が大きくふくらみます。</p>
        <p className="text-xs text-ink-muted">
          雲は残り時間が少なくなるほど、淡く空にとけていきます。期限がくると内容も消えます。
        </p>
      </div>
      <p className="flex items-end gap-2 text-xs text-ink-muted" aria-label="雲の大きさ：静かなルームほど小さく、盛り上がっているほど大きい">
        静か
        <CloudIcon className="h-[17px] w-6 text-[color-mix(in_oklch,var(--color-cloud)_60%,var(--color-cloud-mist))]" />
        <ArrowRight className="mb-0.5 size-3.5" aria-hidden />
        <CloudIcon className="h-[22px] w-8 text-[color-mix(in_oklch,var(--color-cloud)_60%,var(--color-cloud-mist))]" />
        <ArrowRight className="mb-0.5 size-3.5" aria-hidden />
        <CloudIcon className="h-7 w-10 text-[color-mix(in_oklch,var(--color-cloud)_60%,var(--color-cloud-mist))]" />
        盛り上がり
      </p>
    </div>
  );
}

/** ルーム作成（S-05）へのボタン */
export function CreateRoomLink({ className }: { className?: string }) {
  return (
    <Link
      href="/rooms/new"
      className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 rounded-xl px-7 text-sm font-bold", className)}
    >
      <Plus aria-hidden />
      ルームをつくる
    </Link>
  );
}

/** ルームがまだないとき */
export function RoomCloudEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <CloudIcon className="h-16 w-24 opacity-60" />
      <p className="font-bold text-ink">空はまだ晴れています</p>
      <p className="text-sm text-ink-muted">ルームを作ると、ここに雲が浮かびます。</p>
      <CreateRoomLink className="mt-2" />
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
