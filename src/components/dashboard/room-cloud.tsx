import Link from "next/link";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type RoomCloudProps = {
  href: string;
  name: string;
  /** 雲の下に出す残り日数（「あと3日」「今日まで」） */
  remainingLabel: string;
  /** 今日で消えるルームは残り日数を目立たせる */
  endsToday?: boolean;
  /** 雲の大きさ（一覧で順番に変えて、空に浮かんでいるように見せる） */
  size?: "sm" | "md" | "lg";
  /** ふわふわ動くタイミングをずらす（秒） */
  floatDelay?: number;
};

const SIZE = {
  sm: "w-36 md:w-48",
  md: "w-40 md:w-56",
  lg: "w-44 md:w-64",
} as const;

/** ダッシュボードの「雲」1つ＝ルーム1つ。クリックでチャット（管理者用）へ */
export function RoomCloud({
  href,
  name,
  remainingLabel,
  endsToday = false,
  size = "md",
  floatDelay = 0,
}: RoomCloudProps) {
  return (
    <li
      className="flex flex-col items-center gap-2 motion-safe:animate-cloud-float"
      style={{ animationDelay: `${floatDelay}s` }}
    >
      <Link
        href={href}
        className={cn(
          "group relative block rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          SIZE[size],
        )}
      >
        {/* brand/cloud-icon.tsx と同じ雲の形 */}
        <svg
          viewBox="0 0 32 22"
          fill="currentColor"
          aria-hidden
          className="w-full text-cloud drop-shadow-[0_6px_12px_rgb(53_88_114/0.12)] transition-colors group-hover:text-cloud-strong"
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
    </li>
  );
}
