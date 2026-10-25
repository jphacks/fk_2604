import type { CSSProperties } from "react";
import Link from "next/link";
import { Clock, Settings } from "lucide-react";
import { CloudBubble } from "@/components/brand/cloud-bubble";
import type { CloudSize } from "@/lib/room-heat";
import { cn } from "@/lib/utils";

type RoomCloudProps = {
  href: string;
  /** ルーム設定（S-07）へのリンク */
  settingsHref: string;
  name: string;
  /** 残り時間（「2日18時間」「03:24:18」） */
  countdown: string;
  /** 参加人数（「3 / 6人」） */
  membersLabel: string;
  /** 初期の生存時間に対する残りの割合 0〜1。雲の濃さになる（0に近いほど空にとける） */
  remainingRatio: number;
  /** 雲の大きさ（会話の盛り上がりで決まる。lib/room-heat.ts） */
  size?: CloudSize;
  /** ふわふわ動くタイミングをずらす（秒） */
  floatDelay?: number;
  className?: string;
};

// 列の幅に対する雲の幅。盛り上がっているルームほど大きい
const SIZE = {
  sm: "w-[79%]",
  md: "w-[85%]",
  lg: "w-[90%]",
} as const;

/** 残りがこれより少ない雲は、端から小さな粒になってとけていく */
const FADING_RATIO = 0.3;

/** ダッシュボードの「雲」1つ＝ルーム1つ。クリックでチャットへ */
export function RoomCloud({
  href,
  settingsHref,
  name,
  countdown,
  membersLabel,
  remainingRatio,
  size = "md",
  floatDelay = 0,
  className,
}: RoomCloudProps) {
  const fading = remainingRatio < FADING_RATIO;

  return (
    // 外側でずらし（className）、内側でふわふわ動かす（transform が重ならないように分ける）
    <li className={cn("relative z-10 flex justify-center", className)}>
      <div
        className={cn(
          "group relative motion-safe:animate-cloud-float",
          // 大きさが変わるときはふわっと変える（動きを減らす設定の人には変えない）
          "transition-[width] duration-700 ease-out motion-reduce:transition-none",
          SIZE[size],
        )}
        // 残りの割合を CSS変数で渡し、color-mix で水色と消えかけの色を混ぜる
        // （満タンでも水色 60% までにして、文字が読みやすい淡さにとどめる）
        style={
          {
            animationDelay: `${floatDelay}s`,
            "--cloud-tint": `${Math.round(remainingRatio * 60)}%`,
          } as CSSProperties
        }
      >
        <CloudBubble className="text-[color-mix(in_oklch,var(--color-cloud)_var(--cloud-tint),var(--color-cloud-mist))] transition-[color,filter] duration-700 group-has-[a:hover]:brightness-[0.97]" />

        {fading && (
          // 右端からこぼれる小さな雲の粒
          <span aria-hidden className="text-[color-mix(in_oklch,var(--color-cloud)_var(--cloud-tint),var(--color-cloud-mist))]">
            <span className="absolute top-[42%] -right-[4%] size-[6%] rounded-full bg-current" />
            <span className="absolute top-[60%] -right-[1%] size-[4.5%] rounded-full bg-current" />
            <span className="absolute top-[47%] -right-[9%] size-[2.5%] rounded-full bg-current" />
            <span className="absolute top-[72%] right-[3%] size-[2%] rounded-full bg-current" />
          </span>
        )}

        {/* 雲のふくらんだ真ん中に中身を置く */}
        <div className="absolute inset-x-[14%] top-[28%] bottom-[20%] flex flex-col justify-center gap-1 text-ink md:gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-1 text-base font-bold break-all md:text-lg">{name}</h2>
            <Link
              href={settingsHref}
              className="relative z-10 -m-1.5 shrink-0 rounded-full p-1.5 text-cloud-deep outline-none hover:bg-white/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`${name}の設定`}
              title="ルーム設定"
            >
              <Settings className="size-4 md:size-5" aria-hidden />
            </Link>
          </div>

          <p className="flex items-center gap-1.5 text-2xl font-bold tabular-nums md:text-[28px]">
            <Clock className="size-4 shrink-0 md:size-5" aria-hidden />
            <span className="sr-only">残り</span>
            {countdown}
          </p>

          <div className="flex items-end justify-between gap-2">
            <p className="text-xs text-ink-muted tabular-nums md:text-sm">{membersLabel}</p>
            {/* 雲全体をクリックできるよう、リンクの当たり判定を雲いっぱいに広げる */}
            <Link
              href={href}
              className="shrink-0 rounded-md text-xs font-bold tracking-wide whitespace-nowrap outline-none after:absolute after:-inset-x-[16%] after:-top-[40%] after:-bottom-[25%] after:rounded-[40%] after:content-[''] hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              チャットへ →
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
