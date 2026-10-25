import type { CSSProperties } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";
import type { CloudSize } from "@/lib/room-heat";
import { cn } from "@/lib/utils";

type RoomCloudProps = {
  href: string;
  name: string;
  /** 雲の下に出す残り日数（「あと3日」「今日まで」） */
  remainingLabel: string;
  /** 今日で消えるルームは残り日数を目立たせる */
  endsToday?: boolean;
  /** 雲の大きさ（会話の盛り上がりで決まる。lib/room-heat.ts） */
  size?: CloudSize;
  /** 雲の色の濃さ 0〜1（0＝淡い水色 --cloud-soft、1＝水色 --cloud。会話の盛り上がりで決まる） */
  tint?: number;
  /** ふわふわ動くタイミングをずらす（秒） */
  floatDelay?: number;
  className?: string;
};

const SIZE = {
  sm: "w-36 md:w-48",
  md: "w-40 md:w-56",
  lg: "w-44 md:w-64",
} as const;

/** ダッシュボードの「雲」1つ＝ルーム1つ。クリックでチャットへ */
export function RoomCloud({
  href,
  name,
  remainingLabel,
  endsToday = false,
  size = "md",
  tint = 1,
  floatDelay = 0,
  className,
}: RoomCloudProps) {
  return (
    // 外側でずらし（className）、内側でふわふわ動かす（transform が重ならないように分ける）
    <li className={className}>
      <div
        className="flex flex-col items-center gap-2 motion-safe:animate-cloud-float"
        style={{ animationDelay: `${floatDelay}s` }}
      >
        <Link
          href={href}
          className={cn(
            "group relative block rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            // 大きさが変わるときはふわっと変える（動きを減らす設定の人には変えない）
            "transition-[width] duration-700 ease-out motion-reduce:transition-none",
            SIZE[size],
          )}
          // 色の濃さを CSS変数で渡し、下の svg の color-mix で淡い水色と水色を混ぜる
          // （白だと背景に溶けて見えないので、静かなルームも淡い水色にする）
          style={{ "--cloud-tint": `${Math.round(tint * 100)}%` } as CSSProperties}
        >
          {/* brand/cloud-icon.tsx と同じ雲の形 */}
          <svg
            viewBox="0 0 32 22"
            fill="currentColor"
            aria-hidden
            className="w-full text-[color-mix(in_oklch,var(--color-cloud)_var(--cloud-tint),var(--color-cloud-soft))] drop-shadow-[0_6px_12px_rgb(53_88_114/0.12)] transition-[color,filter] duration-700 group-hover:brightness-95"
          >
            <path d="M8.5 22A7.5 7.5 0 0 1 7.4 7.1 9 9 0 0 1 24.2 6a8 8 0 0 1 .3 16Z" />
          </svg>
          {/* 雲のふくらんだ下の方に名前を置く */}
          <span className="absolute inset-x-[14%] top-[38%] bottom-[10%] flex items-center justify-center text-center">
            <span className="line-clamp-2 text-sm font-bold leading-snug break-all text-ink md:text-base">
              {name}
            </span>
          </span>
        </Link>

        <p
          className={cn(
            "flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs tabular-nums ring-1 ring-line",
            endsToday ? "font-bold text-ink" : "text-ink-muted",
          )}
        >
          <Timer className="size-3.5" aria-hidden />
          {remainingLabel}
        </p>
      </div>
    </li>
  );
}
