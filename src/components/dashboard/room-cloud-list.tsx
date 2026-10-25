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

/**
 * 雲ごとのずれ（横・縦）と、ふわふわ動く周期。順番にくり返して使い、
 * 格子に並べず、空に自由に浮かんでいるように見せる。
 * 縦のずれは上の余白として場所をとるので、下の雲と重ならない。
 * 横のずれ（±12px）とふわふわの動き（最大10px）を足しても、隣との間（gap-x-12 = 48px）より小さくしておくこと
 */
const SCATTER = [
  { dx: "-8px", dy: "0px", duration: 9 },
  { dx: "10px", dy: "44px", duration: 11 },
  { dx: "-12px", dy: "16px", duration: 10 },
  { dx: "12px", dy: "32px", duration: 12 },
  { dx: "0px", dy: "4px", duration: 8.5 },
  { dx: "-10px", dy: "40px", duration: 10.5 },
  { dx: "8px", dy: "12px", duration: 9.5 },
] as const;

/** ダッシュボードの空。ルームを雲として折り返し並べ、1つずつ位置をずらして浮かべる */
export function RoomCloudList({ rooms }: { rooms: RoomCloudItem[] }) {
  return (
    <ul className="mx-auto flex max-w-md flex-col items-center gap-y-6 md:max-w-none md:flex-row md:flex-wrap md:items-start md:justify-center md:gap-x-12 md:gap-y-10">
      {rooms.map((room, i) => {
        const scatter = SCATTER[i % SCATTER.length];
        return (
          <RoomCloud
            key={room.id}
            href={room.href}
            settingsHref={room.settingsHref}
            name={room.name}
            countdown={room.countdown}
            membersLabel={room.membersLabel}
            remainingRatio={room.remainingRatio}
            size={room.size}
            floatDelay={-(i * 1.7)}
            floatDuration={scatter.duration}
            offset={{ x: scatter.dx, y: scatter.dy }}
          />
        );
      })}
    </ul>
  );
}

/** 雲の大きさの説明（会話が盛り上がっているルームほど大きく、濃い。濃さは room-cloud.tsx の CLOUD_TINT と合わせる） */
export function RoomCloudLegend() {
  return (
    <div className="mt-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink">
          会話が盛り上がっているルームほど、雲が大きくふくらみます。
        </p>
        <p className="text-xs text-ink-muted">
          雲は残り時間が少なくなるほど、淡く空にとけていきます。期限がくると内容も消えます。
        </p>
      </div>
      <p
        className="flex items-end gap-2 text-xs text-ink-muted"
        aria-label="雲の大きさ：静かなルームほど小さく、盛り上がっているほど大きい"
      >
        静か
        <CloudIcon className="h-[17px] w-6 text-[color-mix(in_oklch,var(--color-cloud)_60%,var(--color-cloud-mist))]" />
        <ArrowRight className="mb-0.5 size-3.5" aria-hidden />
        <CloudIcon className="h-[26px] w-[38px] text-[color-mix(in_oklch,var(--color-cloud)_80%,var(--color-cloud-mist))]" />
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
      className={cn(
        buttonVariants({ size: "lg" }),
        "h-12 gap-2 rounded-xl px-7 text-sm font-bold",
        className,
      )}
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
      <p className="text-sm text-ink-muted">
        ルームを作ると、ここに雲が浮かびます。
      </p>
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
