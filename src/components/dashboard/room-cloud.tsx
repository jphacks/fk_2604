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
  /** 残り時間（「2日」「03:24:18」） */
  countdown: string;
  /** 参加人数（「3 / 6人」） */
  membersLabel: string;
  /** 初期の生存時間に対する残りの割合 0〜1。雲の濃さになる（0に近いほど空にとける） */
  remainingRatio: number;
  /** 雲の大きさ（会話の盛り上がりで決まる。lib/room-heat.ts） */
  size?: CloudSize;
  /** ふわふわ動くタイミングをずらす（秒） */
  floatDelay?: number;
  /** ふわふわ動く1周の長さ（秒）。雲ごとに変えて動きをそろえない */
  floatDuration?: number;
  /** 並びからのずれ（md 以上）。x は横にずらすだけ、y は上の余白になる（重ならない）。CSS の長さ（「8px」） */
  offset?: { x: string; y: string };
  className?: string;
};

// 雲の幅。盛り上がっているルームほど大きい（スマホは画面幅に対する割合、md 以上は固定の幅）
const SIZE = {
  sm: "w-[62%] md:w-[240px] lg:w-[250px]",
  md: "w-[86%] md:w-[370px] lg:w-[400px]",
} as const;

/**
 * チャット名の文字の大きさ。短い名前は大きく、長い名前は少し小さくして2行に収める
 * （cqw は雲の幅に対する割合なので、雲が大きいほど文字も大きい）
 */
function nameSizeClass(name: string) {
  if (name.length <= 10) return "text-[clamp(17px,6cqw,28px)]";
  if (name.length <= 20) return "text-[clamp(15px,4.8cqw,23px)]";
  return "text-[clamp(14px,4.2cqw,20px)]";
}

/**
 * 満タンのときの水色の割合（%）。小さい雲の色を起点に、盛り上がっている雲ほど水色を濃くする。
 * 残り時間が減ると、この値から 0（消えかけの色）へ近づいていく
 */
export const CLOUD_TINT = {
  sm: 60,
  md: 80,
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
  floatDuration = 10,
  offset,
  className,
}: RoomCloudProps) {
  const fading = remainingRatio < FADING_RATIO;

  return (
    // 外側でずらし（offset）、内側でふわふわ動かす（transform が重ならないように分ける）
    <li
      className={cn(
        "relative z-10 flex w-full justify-center md:w-auto md:translate-x-(--cloud-dx) md:pt-(--cloud-dy)",
        className,
      )}
      style={
        {
          "--cloud-dx": offset?.x ?? "0px",
          "--cloud-dy": offset?.y ?? "0px",
        } as CSSProperties
      }
    >
      <div
        className={cn(
          // @container：中の文字を雲の幅に合わせて大きくする（cqw）
          "group @container relative motion-safe:animate-cloud-float",
          // 大きさが変わるときはふわっと変える（動きを減らす設定の人には変えない）
          "transition-[width] duration-700 ease-out motion-reduce:transition-none",
          SIZE[size],
        )}
        // 残りの割合を CSS変数で渡し、color-mix で水色と消えかけの色を混ぜる
        // （満タンのときの濃さは大きさで変える。CLOUD_TINT）
        style={
          {
            animationDelay: `${floatDelay}s`,
            animationDuration: `${floatDuration}s`,
            "--cloud-tint": `${Math.round(remainingRatio * CLOUD_TINT[size])}%`,
          } as CSSProperties
        }
      >
        {/* 雲の形と中身。残り時間はこの下に置く */}
        <div className="relative">
          <CloudBubble className="text-[color-mix(in_oklch,var(--color-cloud)_var(--cloud-tint),var(--color-cloud-mist))] transition-[color,filter] duration-700 group-has-[a:hover]:brightness-[0.97]" />

          {fading && (
            // 右端からこぼれる小さな雲の粒
            <span
              aria-hidden
              className="text-[color-mix(in_oklch,var(--color-cloud)_var(--cloud-tint),var(--color-cloud-mist))]"
            >
              <span className="absolute top-[42%] -right-[4%] size-[6%] rounded-full bg-current" />
              <span className="absolute top-[60%] -right-[1%] size-[4.5%] rounded-full bg-current" />
              <span className="absolute top-[47%] -right-[9%] size-[2.5%] rounded-full bg-current" />
              <span className="absolute top-[72%] right-[3%] size-[2%] rounded-full bg-current" />
            </span>
          )}

          {/* 雲のふくらんだ真ん中に中身を置く */}
          <div className="absolute inset-x-[14%] top-[28%] bottom-[18%] flex flex-col justify-center gap-[2cqw] text-ink">
            <div className="flex items-start justify-between gap-2">
              {/* 長い名前は2行まで折り返し、それでも入らない分は「…」にする（全文は title で見られる） */}
              <h2
                className={cn(
                  "line-clamp-2 leading-snug font-bold text-balance break-words",
                  nameSizeClass(name),
                )}
                title={name}
              >
                {name}
              </h2>
              <Link
                href={settingsHref}
                className="relative z-10 -m-1.5 shrink-0 rounded-full p-1.5 text-cloud-deep outline-none hover:bg-white/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`${name}の設定`}
                title="ルーム設定"
              >
                <Settings className="size-4 md:size-5" aria-hidden />
              </Link>
            </div>

            <div className="flex items-end justify-between gap-2">
              <p className="text-[clamp(12px,3.2cqw,15px)] text-ink-muted tabular-nums">
                {membersLabel}
              </p>
              {/* 雲全体をクリックできるよう、リンクの当たり判定を雲いっぱいに広げる */}
              <Link
                href={href}
                className="shrink-0 rounded-md text-[clamp(12px,3.2cqw,15px)] font-bold tracking-wide whitespace-nowrap outline-none after:absolute after:-inset-x-[16%] after:-top-[40%] after:-bottom-[25%] after:rounded-[40%] after:content-[''] hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                チャットへ →
              </Link>
            </div>
          </div>
        </div>

        {/* 残り時間は雲の下（しっぽの右側）に小さく。margin の % は幅基準なので、雲の底のすぐ下に寄せられる */}
        <p className="-mt-[5%] flex items-center justify-end gap-1 pr-[16%] text-xs text-ink-muted tabular-nums md:text-[13px]">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          残り {countdown}
        </p>
      </div>
    </li>
  );
}
